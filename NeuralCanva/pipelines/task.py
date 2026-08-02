from celery import shared_task
from collections import deque
import httpx
import logging
from .cache import get_cached_result, set_cached_result
import time
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import base64
import os
import json

logger = logging.getLogger(__name__)

FASTAPI_URL = "http://localhost:8001"


def topological_sort(nodes, edges):
    node_ids = [n['id'] for n in nodes]
    in_degree = {nid: 0 for nid in node_ids}
    adjacency = {nid: [] for nid in node_ids}

    for edge in edges:
        adjacency[edge['source']].append(edge['target'])
        in_degree[edge['target']] += 1

    queue = deque([nid for nid in node_ids if in_degree[nid] == 0])
    order = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbour in adjacency[node]:
            in_degree[neighbour] -= 1
            if in_degree[neighbour] == 0:
                queue.append(neighbour)

    if len(order) != len(node_ids):
        raise ValueError("Graph has a cycle.")

    return order


def broadcast(pipeline_id, message, stage=None, percent=None):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'run_{pipeline_id}_logs',
        {'type': 'log_message', 'message': message, 'stage': stage, 'percent': percent}
    )


@shared_task(bind=True)
def execute_graph(self, graph_id):
    from .models import Graph

    graph = Graph.objects.select_related('pipeline__owner').get(id=graph_id)
    user_id = graph.pipeline.owner.id
    nodes = graph.nodes
    edges = graph.edges

    # ── cache check ───────────────────────────────
    cached = get_cached_result(user_id, nodes, edges)
    if cached:
        logger.info(f"Cache hit for graph {graph_id} — skipping execution.")
        graph.status = 'success'
        graph.result = cached
        broadcast(graph.pipeline_id, "Loaded cached result", stage="cached", percent=100)
        graph.save()
        return

    # ── execute ───────────────────────────────────
    graph.status = 'running'
    graph.error = ''
    graph.save()

    start_time = time.time()
    os.makedirs(f'media/artifacts/{graph_id}', exist_ok=True)

    try:
        node_map = {n['id']: n for n in nodes}
        execution_order = topological_sort(nodes, edges)
        node_outputs = {}
        total_nodes = len(execution_order)

        broadcast(graph.pipeline_id, f"Starting run — {total_nodes} nodes to execute", stage="starting", percent=0)

        for i, node_id in enumerate(execution_order):
            node = node_map[node_id]
            parent_ids = [e['source'] for e in edges if e['target'] == node_id]
            input_data = node_outputs.get(parent_ids[0]) if parent_ids else {}

            payload = {
                "algorithm_type": node['type'],
                "params": node.get('params', {}),
                "input_data": input_data,
            }

            percent_before = int((i / total_nodes) * 100)
            broadcast(graph.pipeline_id, f"Running node: {node['type']}", stage=node['type'], percent=percent_before)

            response = httpx.post(f"{FASTAPI_URL}/execute", json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            node_outputs[node_id] = result

            # ── save artifacts for THIS node, every iteration ──
            if 'model_b64' in result:
                ext = 'h5' if node['type'] in ['DenseNN', 'CNN', 'RNN', 'LSTM', 'GRU', 'Autoencoder'] else 'pkl'
                path = f'media/artifacts/{graph_id}/model.{ext}'
                with open(path, 'wb') as f:
                    f.write(base64.b64decode(result['model_b64']))

            if 'scaler_params' in result:
                path = f'media/artifacts/{graph_id}/{node["type"]}.json'
                with open(path, 'w') as f:
                    json.dump(result['scaler_params'], f)

            percent_after = int(((i + 1) / total_nodes) * 100)
            broadcast(graph.pipeline_id, f"Finished node: {node['type']}", stage=node['type'], percent=percent_after)

        final_output = node_outputs.get(execution_order[-1])
        elapsed = round(time.time() - start_time, 2)

        # ── cache store ───────────────────────────
        set_cached_result(user_id, nodes, edges, final_output)

        graph.status = 'success'
        graph.result = final_output
        graph.elapsed_seconds = elapsed
        graph.save()

        broadcast(graph.pipeline_id, f"Run complete in {elapsed}s", stage="done", percent=100)

    except httpx.HTTPError as e:
        graph.status = 'failed'
        graph.error = f"FastAPI call failed: {str(e)}"
        graph.save()
        broadcast(graph.pipeline_id, f"Failed: {str(e)}", stage="error", percent=None)

    except Exception as e:
        graph.status = 'failed'
        graph.error = str(e)
        graph.save()
        broadcast(graph.pipeline_id, f"Failed: {str(e)}", stage="error", percent=None)