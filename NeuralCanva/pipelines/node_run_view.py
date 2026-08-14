import httpx
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph
from .task import broadcast, FASTAPI_URL

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
                import pandas as pd
                from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
                df = pd.DataFrame(input_data.get('dataframe', {}))
                params = target_node['data'].get('params', {})
                method = params.get('method', 'OneHot')
                features = params.get('features', [])
                before_cols = len(df.columns)

                if method == 'OneHot':
                    df = pd.get_dummies(df, columns=features, drop_first=False)
                elif method == 'Label':
                    for col in features:
                        if col in df.columns:
                            df[col] = LabelEncoder().fit_transform(df[col].astype(str))
                elif method == 'Ordinal':
                    valid_feats = [f for f in features if f in df.columns]
                    if valid_feats:
                        enc = OrdinalEncoder()
                        df[valid_feats] = enc.fit_transform(df[valid_feats].astype(str))
                elif method == 'Target':
                    target_col = params.get('target_column')
                    if target_col and target_col in df.columns:
                        for col in features:
                            if col in df.columns:
                                df[col] = df.groupby(col)[target_col].transform('mean')

                after_cols = len(df.columns)
                result = {"dataframe": df.to_dict(orient='list'), "columns": list(df.columns)}
                broadcast(graph.pipeline_id, f"Single Run: {method} encoding — columns: {before_cols} → {after_cols}", stage=node_type)

            elif node_type == 'splitDataset':
                import pandas as pd
                df = pd.DataFrame(input_data.get('dataframe', {}))
                target_column = target_node['data'].get('params', {}).get('target_column')
                if not target_column or target_column not in df.columns:
                    return JsonResponse({"detail": f"Target column '{target_column}' missing from dataset."}, status=400)
                df = df.dropna()
                feature_df = df.drop(columns=[target_column])
                numeric_cols = feature_df.select_dtypes(include=['number']).columns.tolist()
                X = feature_df[numeric_cols].values.tolist()
                y = df[target_column].values.tolist()
                result = {"X": X, "y": y, "columns": numeric_cols}
                broadcast(graph.pipeline_id, f"Single Run: Split dataset on '{target_column}'", stage=node_type)

            else:
                payload = {
                    "algorithm_type": node_type,
                    "params": target_node['data'].get('params', {}),
                    "input_data": input_data,
                }
                resp = httpx.post(f"{FASTAPI_URL}/execute", json=payload, timeout=60)
                resp.raise_for_status()
                result = resp.json()['result']

            node_outputs[node_id] = result
            graph.node_outputs = node_outputs
            graph.save()

            broadcast(graph.pipeline_id, f"Single Node Run Completed: {target_node['data'].get('title', node_id)}", stage="node_success")
            return JsonResponse({"status": "success", "result": result})

        except Exception as e:
            broadcast(graph.pipeline_id, f"Single Node Failed: {str(e)}", stage="node_error")
            return JsonResponse({"detail": str(e)}, status=500)
