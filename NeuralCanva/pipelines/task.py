import logging
import time
import os
from django.conf import settings
from django.db import connection
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

from .cache import get_cached_result, set_cached_result
from .preprocessing_helpers import (
    validate_pipeline_dag,
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


def execute_graph(graph_id, start_from_node_id=None):
    """
    Background worker function to execute a graph DAG.
    Supports full execution and 'Retry From Here' partial execution.
    Guarantees state persistence, performance tracking, model auto-registration,
    and DB connection cleanup.
    """
    from .models import Graph, PipelineExecutionRun, TrainedModel

    graph = None
    node_timings = {}
    node_outputs = {}
    start_time = time.time()
    execution_order = []
    current_executing_index = 0
    nodes = []
    edges = []

    try:
        try:
            graph = Graph.objects.select_related('pipeline__owner').get(id=graph_id)
        except Graph.DoesNotExist:
            logger.error(f"Graph with ID {graph_id} does not exist.")
            return

        user = graph.pipeline.owner
        user_id = user.id
        nodes = graph.nodes or []
        edges = graph.edges or []
        node_outputs = dict(graph.node_outputs or {})

        # ── validate DAG structure ─────────────────────
        execution_order = validate_pipeline_dag(nodes, edges)
        node_map = {str(n.get('id')): n for n in nodes if isinstance(n, dict)}

        # Determine starting point for execution
        start_idx = 0
        if start_from_node_id and str(start_from_node_id) in execution_order:
            start_idx = execution_order.index(str(start_from_node_id))
            logger.info(f"Retrying execution of graph {graph_id} from block '{start_from_node_id}' (step {start_idx + 1}/{len(execution_order)})")

        # Set initial node statuses
        for idx, nid in enumerate(execution_order):
            if nid in node_map and 'data' in node_map[nid]:
                if idx < start_idx:
                    # Keep previous status if already success
                    if node_map[nid]['data'].get('status') != 'success':
                        node_map[nid]['data']['status'] = 'success'
                elif idx == start_idx:
                    node_map[nid]['data']['status'] = 'running'
                else:
                    node_map[nid]['data']['status'] = 'pending'

        graph.status = 'running'
        graph.nodes = clean_for_json(nodes)
        graph.error = ''
        graph.save(update_fields=['status', 'nodes', 'error'])

        os.makedirs(f'media/artifacts/{graph_id}', exist_ok=True)
        total_nodes = len(execution_order)

        broadcast(
            graph.pipeline_id,
            f"Starting DAG run — {total_nodes} blocks ({total_nodes - start_idx} to execute)",
            stage="starting",
            percent=0
        )

        for i in range(start_idx, total_nodes):
            current_executing_index = i
            node_id = execution_order[i]

            # Check if user requested stop/pause
            graph.refresh_from_db(fields=['status'])
            if graph.status in ('idle', 'paused'):
                logger.info(f"Graph {graph_id} execution aborted because status is {graph.status}")
                return

            node = node_map[node_id]
            if 'data' in node:
                node['data']['status'] = 'running'
                graph.nodes = clean_for_json(nodes)
                graph.save(update_fields=['nodes'])

            parent_ids = [str(e['source']) for e in edges if str(e.get('target')) == node_id]
            input_data = node_outputs.get(parent_ids[0]) if parent_ids else {}

            percent_before = int((i / total_nodes) * 100) if total_nodes else 0
            broadcast(
                graph.pipeline_id,
                f"Executing block: {node.get('data', {}).get('title', node_id)}",
                stage=node.get('data', {}).get('nodeType', 'task'),
                percent=percent_before
            )

            node_t0 = time.time()
            result, artifacts, broadcast_msg, stage = execute_single_node(
                node,
                input_data,
                graph_id=graph.id,
                nodes=nodes,
                edges=edges
            )
            node_elapsed = round(time.time() - node_t0, 2)
            node_timings[node_id] = node_elapsed

            save_node_artifacts(graph.id, node_id, artifacts)
            node_outputs[node_id] = result

            if 'data' in node:
                node['data']['status'] = 'success'
                if isinstance(result, dict) and 'columns' in result and result['columns']:
                    node['data']['columns'] = result['columns']

            percent_after = int(((i + 1) / total_nodes) * 100) if total_nodes else 100
            broadcast(graph.pipeline_id, f"{broadcast_msg} [{node_elapsed}s]", stage=stage, percent=percent_after)

        final_output = node_outputs.get(execution_order[-1]) if execution_order else None
        elapsed = round(time.time() - start_time, 2)

        # ── cache store upon complete success ──
        if final_output is not None:
            set_cached_result(user_id, nodes, edges, final_output)

        for nid in execution_order:
            if nid in node_map and 'data' in node_map[nid]:
                node_map[nid]['data']['status'] = 'success'

        graph.status = 'success'
        graph.nodes = clean_for_json(nodes)
        graph.result = clean_for_json(final_output)
        graph.node_outputs = clean_for_json(node_outputs)
        graph.error = ''
        graph.elapsed_seconds = elapsed
        graph.save(update_fields=['status', 'nodes', 'result', 'node_outputs', 'error', 'elapsed_seconds'])

        # Record Execution Run in History
        run_count = PipelineExecutionRun.objects.filter(pipeline=graph.pipeline).count()
        PipelineExecutionRun.objects.create(
            pipeline=graph.pipeline,
            run_number=run_count + 1,
            status='success',
            start_time=timezone.now() - timezone.timedelta(seconds=elapsed),
            end_time=timezone.now(),
            elapsed_seconds=elapsed,
            nodes_snapshot=clean_for_json(nodes),
            node_outputs=clean_for_json(node_outputs),
            node_timings=node_timings,
            error=''
        )

        # Auto-register model in Model Registry if trained
        for out in node_outputs.values():
            if isinstance(out, dict) and out.get('model_b64'):
                algo_name = out.get('metrics', {}).get('task_type', 'ML_Model')
                for n in nodes:
                    ntype = n.get('data', {}).get('nodeType')
                    if ntype not in ('start', 'end', 'loadDataset', 'splitDataset', 'Encoder', 'StandardScaler', 'Histogram', 'Boxplot', 'Correlation', 'DescribeStats', 'predict', 'evaluate'):
                        algo_name = n.get('data', {}).get('title', ntype)
                        break

                model_name = f"{graph.pipeline.name.replace(' ', '_').lower()}_model"
                last_ver = TrainedModel.objects.filter(owner=user, name=model_name).order_by('-version').first()
                new_ver = (last_ver.version + 1) if last_ver else 1

                TrainedModel.objects.create(
                    owner=user,
                    pipeline=graph.pipeline,
                    name=model_name,
                    version=new_ver,
                    algorithm=algo_name,
                    dataset_name=graph.pipeline.name,
                    features=out.get('features', []),
                    metrics=out.get('metrics', {}),
                    model_b64=out['model_b64'],
                    model_format='h5' if 'DenseNN' in algo_name else 'pkl',
                    status='active'
                )
                break

        broadcast(
            graph.pipeline_id,
            f"Pipeline run completed successfully in {elapsed}s",
            stage="done",
            percent=100
        )

    except Exception as e:
        raw_err = str(e)
        error_str = raw_err[:300] + "... [truncated]" if len(raw_err) > 300 else raw_err
        elapsed = round(time.time() - start_time, 2)
        logger.error(f"Graph {graph_id} failed with Exception: {error_str}", exc_info=True)

        try:
            target_graph = Graph.objects.get(id=graph_id)
            current_nodes = target_graph.nodes or nodes or []
            curr_map = {str(n.get('id')): n for n in current_nodes if isinstance(n, dict)}

            failing_node_id = execution_order[current_executing_index] if (execution_order and current_executing_index < len(execution_order)) else None

            for idx, nid in enumerate(execution_order):
                if nid in curr_map and 'data' in curr_map[nid]:
                    if nid == failing_node_id:
                        curr_map[nid]['data']['status'] = 'failed'
                    elif idx > current_executing_index:
                        curr_map[nid]['data']['status'] = 'skipped'
                    elif idx < current_executing_index and curr_map[nid]['data'].get('status') != 'failed':
                        curr_map[nid]['data']['status'] = 'success'

            target_graph.status = 'failed'
            target_graph.nodes = clean_for_json(current_nodes)
            target_graph.node_outputs = clean_for_json(node_outputs)
            target_graph.error = error_str
            target_graph.elapsed_seconds = elapsed
            target_graph.save(update_fields=['status', 'nodes', 'node_outputs', 'error', 'elapsed_seconds'])
            pid = target_graph.pipeline_id

            run_count = PipelineExecutionRun.objects.filter(pipeline=target_graph.pipeline).count()
            PipelineExecutionRun.objects.create(
                pipeline=target_graph.pipeline,
                run_number=run_count + 1,
                status='failed',
                start_time=timezone.now() - timezone.timedelta(seconds=elapsed),
                end_time=timezone.now(),
                elapsed_seconds=elapsed,
                nodes_snapshot=clean_for_json(current_nodes),
                node_outputs=clean_for_json(node_outputs),
                node_timings=node_timings,
                error=error_str
            )
        except Exception as db_err:
            logger.error(f"Failed to update graph status or execution run: {db_err}")
            pid = graph.pipeline_id if graph else None

        broadcast(pid, f"Execution Error: {error_str}", stage="error", percent=None)

    finally:
        connection.close()