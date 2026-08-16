import logging
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph
from .task import broadcast
from .preprocessing_helpers import execute_single_node, save_node_artifacts
from .json_helpers import clean_for_json

logger = logging.getLogger(__name__)


class NodeRunView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, node_id):
        try:
            graph = Graph.objects.get(pipeline_id=pk, pipeline__owner=request.user)
        except Graph.DoesNotExist:
            return JsonResponse({
                "detail": "Pipeline graph not found.",
                "node_id": node_id,
                "node_type": "unknown",
                "errors": ["Pipeline graph does not exist or user lacks permission."]
            }, status=404)

        nodes = graph.nodes or []
        edges = graph.edges or []
        node_map = {str(n.get('id')): n for n in nodes if isinstance(n, dict)}

        if node_id not in node_map:
            return JsonResponse({
                "detail": f"Node '{node_id}' was not found in the pipeline graph.",
                "node_id": node_id,
                "node_type": "unknown",
                "errors": [f"Node ID '{node_id}' does not exist in the current graph."]
            }, status=404)

        target_node = node_map[node_id]
        target_node_data = target_node.get('data', {}) if isinstance(target_node, dict) else {}
        node_type = target_node_data.get('nodeType', 'unknown')
        target_title = target_node_data.get('title', node_id)

        parent_edges = [e for e in edges if isinstance(e, dict) and str(e.get('target')) == node_id]
        node_outputs = graph.node_outputs or {}

        # ── Upstream Dependency Check ──
        missing_dependencies = []
        if node_type not in ('start', 'loadDataset'):
            for edge in parent_edges:
                parent_id = str(edge.get('source'))
                parent_node = node_map.get(parent_id)
                parent_type = parent_node.get('data', {}).get('nodeType') if parent_node else ''
                # Start node does not produce tabular data and is not a data dependency
                if parent_type == 'start':
                    continue
                parent_title = parent_node.get('data', {}).get('title', parent_id) if parent_node else parent_id
                if parent_id not in node_outputs:
                    missing_dependencies.append(f"Required upstream block '{parent_title}' ({parent_id}) has not been executed yet.")

        if missing_dependencies:
            if 'data' in target_node:
                target_node['data']['status'] = 'failed'
                graph.nodes = clean_for_json(nodes)
                graph.save(update_fields=['nodes'])
            return JsonResponse({
                "detail": f"Cannot run {target_title}. Missing output from required upstream blocks.",
                "node_id": node_id,
                "node_type": node_type,
                "errors": missing_dependencies
            }, status=400)

        # Primary input data from first upstream parent
        primary_parent_id = str(parent_edges[0]['source']) if parent_edges else None
        input_data = node_outputs.get(primary_parent_id, {}) if primary_parent_id else {}

        try:
            result, artifacts, broadcast_msg, stage = execute_single_node(
                target_node,
                input_data,
                graph_id=graph.id,
                nodes=nodes,
                edges=edges
            )

            # Persist artifacts (models, features.json, encoder params)
            save_node_artifacts(graph.id, node_id, artifacts)

            cleaned_result = clean_for_json(result)
            node_outputs[node_id] = cleaned_result
            graph.node_outputs = clean_for_json(node_outputs)

            if 'data' in target_node:
                target_node['data']['status'] = 'success'
                if isinstance(result, dict) and 'columns' in result and result['columns']:
                    target_node['data']['columns'] = result['columns']

            graph.nodes = clean_for_json(nodes)
            graph.save(update_fields=['nodes', 'node_outputs'])

            broadcast(graph.pipeline_id, broadcast_msg, stage=stage)

            return JsonResponse({
                "status": "success",
                "node_id": node_id,
                "node_type": node_type,
                "result": cleaned_result
            })

        except ValueError as e:
            err_msg = str(e)
            logger.warning(f"Validation error in node {node_id} ({node_type}): {err_msg}")
            if 'data' in target_node:
                target_node['data']['status'] = 'failed'
                graph.nodes = clean_for_json(nodes)
                graph.save(update_fields=['nodes'])
            broadcast(graph.pipeline_id, f"Node {target_title} Error: {err_msg}", stage="node_error")
            return JsonResponse({
                "detail": err_msg,
                "node_id": node_id,
                "node_type": node_type,
                "errors": [err_msg]
            }, status=400)

        except Exception as e:
            err_msg = str(e)
            logger.error(f"Unexpected error executing node {node_id} ({node_type}): {err_msg}", exc_info=True)
            if 'data' in target_node:
                target_node['data']['status'] = 'failed'
                graph.nodes = clean_for_json(nodes)
                graph.save(update_fields=['nodes'])
            broadcast(graph.pipeline_id, f"Node {target_title} Error: {err_msg}", stage="node_error")
            return JsonResponse({
                "detail": err_msg,
                "node_id": node_id,
                "node_type": node_type,
                "errors": [err_msg]
            }, status=500)
