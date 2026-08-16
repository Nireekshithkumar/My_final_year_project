import logging
import time
import os
from django.conf import settings
from django.db import connection
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

from .cache import get_cached_result, set_cached_result
from .preprocessing_helpers import (
    validate_and_sort_graph,
    execute_single_node,
    save_node_artifacts,
)
from .json_helpers import clean_for_json


def broadcast(pipeline_id, message, stage=None, percent=None):
    """
    Safely broadcast log message to Django Channels WebSocket group.
    Isolates Redis/WebSocket failures from pipeline execution.
    """
    if not pipeline_id:
        return
    try:
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f'run_{pipeline_id}_logs',
                {
                    'type': 'log_message',
                    'message': message,
                    'stage': stage,
                    'percent': percent,
                }
            )
    except Exception as e:
        logger.warning(f"WebSocket broadcast error for pipeline {pipeline_id}: {e}")


def execute_graph(graph_id):
    """
    Background worker function to execute a graph DAG.
    Guarantees that graph status is updated (success/failed) and DB connection is released.
    """
    from .models import Graph

    graph = None
    try:
        try:
            graph = Graph.objects.select_related('pipeline__owner').get(id=graph_id)
        except Graph.DoesNotExist:
            logger.error(f"Graph with ID {graph_id} does not exist.")
            return

        user_id = graph.pipeline.owner.id
        nodes = graph.nodes or []
        edges = graph.edges or []

        # ── cache check ───────────────────────────────
        cached = get_cached_result(user_id, nodes, edges)
        if cached:
            logger.info(f"Cache hit for graph {graph_id} — skipping execution.")
            graph.status = 'success'
            graph.result = cached
            graph.error = ''
            graph.save(update_fields=['status', 'result', 'error'])
            broadcast(graph.pipeline_id, "Loaded cached result", stage="cached", percent=100)
            return

        # ── validate DAG and get execution order ──────
        execution_order = validate_and_sort_graph(nodes, edges)

        graph.status = 'running'
        graph.error = ''
        graph.save(update_fields=['status', 'error'])

        start_time = time.time()
        os.makedirs(f'media/artifacts/{graph_id}', exist_ok=True)

        node_map = {str(n.get('id')): n for n in nodes if isinstance(n, dict)}
        node_outputs = {}
        total_nodes = len(execution_order)

        broadcast(
            graph.pipeline_id,
            f"Starting run — {total_nodes} blocks to execute",
            stage="starting",
            percent=0
        )

        for i, node_id in enumerate(execution_order):
            # Check if user requested stop/pause
            graph.refresh_from_db(fields=['status'])
            if graph.status in ('idle', 'paused'):
                logger.info(f"Graph {graph_id} execution aborted because status is {graph.status}")
                return

            node = node_map[node_id]
            parent_ids = [str(e['source']) for e in edges if str(e.get('target')) == node_id]
            input_data = node_outputs.get(parent_ids[0]) if parent_ids else {}

            percent_before = int((i / total_nodes) * 100) if total_nodes else 0
            broadcast(
                graph.pipeline_id,
                f"Running block: {node.get('data', {}).get('title', node_id)}",
                stage=node.get('data', {}).get('nodeType', 'task'),
                percent=percent_before
            )

            node_t0 = time.time()
            # Execute single node via unified engine
            result, artifacts, broadcast_msg, stage = execute_single_node(
                node,
                input_data,
                graph_id=graph.id,
                nodes=nodes,
                edges=edges
            )
            node_elapsed = round(time.time() - node_t0, 2)

            # Save artifacts
            save_node_artifacts(graph.id, node_id, artifacts)

            node_outputs[node_id] = result

            percent_after = int(((i + 1) / total_nodes) * 100) if total_nodes else 100
            broadcast(graph.pipeline_id, f"{broadcast_msg} [{node_elapsed}s]", stage=stage, percent=percent_after)

        final_output = node_outputs.get(execution_order[-1]) if execution_order else None
        elapsed = round(time.time() - start_time, 2)

        # ── cache store (only upon complete success) ──
        if final_output is not None:
            set_cached_result(user_id, nodes, edges, final_output)

        graph.status = 'success'
        graph.result = clean_for_json(final_output)
        graph.node_outputs = clean_for_json(node_outputs)
        graph.error = ''
        graph.elapsed_seconds = elapsed
        graph.save(update_fields=['status', 'result', 'node_outputs', 'error', 'elapsed_seconds'])

        broadcast(
            graph.pipeline_id,
            f"Run complete in {elapsed}s",
            stage="done",
            percent=100
        )

    except Exception as e:
        error_str = str(e)
        logger.error(f"Graph {graph_id} failed with Exception: {error_str}", exc_info=True)
        try:
            target_graph = Graph.objects.get(id=graph_id)
            target_graph.status = 'failed'
            target_graph.error = error_str
            target_graph.save(update_fields=['status', 'error'])
            pid = target_graph.pipeline_id
        except Exception as db_err:
            logger.error(f"Failed to update graph status: {db_err}")
            pid = graph.pipeline_id if graph else None

        broadcast(pid, f"Failed: {error_str}", stage="error", percent=None)

    finally:
        connection.close()