import httpx
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph
from .task import broadcast, FASTAPI_URL
from .preprocessing_helpers import run_split_dataset, run_encoder_node


class NodeRunView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, node_id):
        try:
            graph = Graph.objects.get(pipeline_id=pk, pipeline__owner=request.user)
        except Graph.DoesNotExist:
            return JsonResponse({"detail": "Pipeline graph not found."}, status=404)

        nodes = graph.nodes or []
        edges = graph.edges or []
        node_map = {n['id']: n for n in nodes}

        if node_id not in node_map:
            return JsonResponse({"detail": f"Node '{node_id}' not found in pipeline graph."}, status=404)

        target_node = node_map[node_id]
        parent_edges = [e for e in edges if e['target'] == node_id]

        node_outputs = graph.node_outputs or {}

        # ── Dependency Check ──
        for edge in parent_edges:
            parent_id = edge['source']
            parent_node = node_map.get(parent_id)
            parent_title = parent_node['data'].get('title', parent_id) if parent_node else parent_id
            if parent_id not in node_outputs:
                target_title = target_node['data'].get('title', node_id)
                return JsonResponse({
                    "detail": f"Cannot run {target_title}. Required previous block: {parent_title}"
                }, status=400)

        # Get primary parent input data
        primary_parent_id = parent_edges[0]['source'] if parent_edges else None
        input_data = node_outputs.get(primary_parent_id, {}) if primary_parent_id else {}
        node_type = target_node['data'].get('nodeType')

        try:
            if node_type == 'loadDataset':
                from datasets.models import Dataset
                import pandas as pd
                dataset_id = target_node['data'].get('datasetId')
                if not dataset_id:
                    return JsonResponse({"detail": "No dataset selected for Load Dataset node."}, status=400)
                try:
                    dataset = Dataset.objects.get(id=dataset_id)
                except Dataset.DoesNotExist:
                    return JsonResponse({"detail": f"Dataset {dataset_id} does not exist."}, status=400)

                df = pd.read_csv(dataset.file.path)
                result = {"dataframe": df.to_dict(orient='list'), "columns": list(df.columns), "column_types": dataset.column_types}

            elif node_type == 'Encoder':
                params = target_node['data'].get('params', {})
                result, before_cols, after_cols = run_encoder_node(input_data, params)
                
                # Save params to artifact using node_id
                path = f'media/artifacts/{graph.id}/{node_id}.json'
                import json, os
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, 'w') as f:
                    json.dump(result['encoder_params'], f)
                
                # Save latest columns to features.json
                with open(f'media/artifacts/{graph.id}/features.json', 'w') as f:
                    json.dump(result.get('columns', []), f)
                
                broadcast(graph.pipeline_id, f"Single Run: {params.get('method', 'OneHot')} encoding — columns: {before_cols} → {after_cols}", stage=node_type)

            elif node_type == 'splitDataset':
                params = target_node['data'].get('params', {})
                result, dropped_rows, train_len, test_len, feature_cols = run_split_dataset(input_data, params)
                
                if dropped_rows > 0:
                    broadcast(graph.pipeline_id, f"Warning: Removed {dropped_rows} rows containing missing/NaN values.", stage="warning")
                
                # Save latest columns to features.json
                import os, json
                os.makedirs(f'media/artifacts/{graph.id}', exist_ok=True)
                with open(f'media/artifacts/{graph.id}/features.json', 'w') as f:
                    json.dump(feature_cols, f)
                
                broadcast(graph.pipeline_id, f"Single Run: Split dataset on '{params.get('target_column')}' — train: {train_len} rows, test: {test_len} rows", stage=node_type)

            else:
                payload = {
                    "algorithm_type": node_type,
                    "params": target_node['data'].get('params', {}),
                    "input_data": input_data,
                }
                resp = httpx.post(f"{FASTAPI_URL}/execute", json=payload, timeout=60)
                resp.raise_for_status()
                result = resp.json()['result']

                # Save artifacts if they exist in result
                if 'model_b64' in result:
                    ext = 'h5' if node_type in ['DenseNN', 'CNN', 'RNN', 'LSTM', 'GRU', 'Autoencoder'] else 'pkl'
                    path = f'media/artifacts/{graph.id}/model.{ext}'
                    import os, base64
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, 'wb') as f:
                        f.write(base64.b64decode(result['model_b64']))

                if 'scaler_params' in result:
                    path = f'media/artifacts/{graph.id}/{node_id}.json'
                    import os, json
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, 'w') as f:
                        json.dump(result['scaler_params'], f)

                if 'vectorizer_params' in result:
                    path = f'media/artifacts/{graph.id}/{node_id}.json'
                    import os, json
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, 'w') as f:
                        json.dump(result['vectorizer_params'], f)

                if 'encoder_params' in result:
                    path = f'media/artifacts/{graph.id}/{node_id}.json'
                    import os, json
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, 'w') as f:
                        json.dump(result['encoder_params'], f)

                # Save latest columns to features.json
                if 'columns' in result:
                    import os, json
                    os.makedirs(f'media/artifacts/{graph.id}', exist_ok=True)
                    with open(f'media/artifacts/{graph.id}/features.json', 'w') as f:
                        json.dump(result['columns'], f)

            node_outputs[node_id] = result
            graph.node_outputs = node_outputs
            graph.save()

            broadcast(graph.pipeline_id, f"Single Node Run Completed: {target_node['data'].get('title', node_id)}", stage="node_success")
            return JsonResponse({"status": "success", "result": result})

        except Exception as e:
            broadcast(graph.pipeline_id, f"Single Node Failed: {str(e)}", stage="node_error")
            return JsonResponse({"detail": str(e)}, status=500)
