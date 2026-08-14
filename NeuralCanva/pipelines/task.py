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
        {'type': 'log_message', 'message': message,
            'stage': stage, 'percent': percent}
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
        broadcast(graph.pipeline_id, "Loaded cached result",
                  stage="cached", percent=100)
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

        broadcast(graph.pipeline_id,
                  f"Starting run — {total_nodes} nodes to execute", stage="starting", percent=0)

        for i, node_id in enumerate(execution_order):
            node = node_map[node_id]
            parent_ids = [e['source'] for e in edges if e['target'] == node_id]
            input_data = node_outputs.get(parent_ids[0]) if parent_ids else {}
            node_type = node['data']['nodeType']


            if node_type in ('start', 'end'):
                # flow-control markers only — no computation, just pass data through
                node_outputs[node_id] = input_data
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"{node_type.title()} Task", stage=node_type, percent=percent_after)
                continue

            if node_type == 'loadDataset':
                from datasets.models import Dataset
                import pandas as pd
                dataset_id = node['data'].get('datasetId')
                if not dataset_id:
                    raise ValueError("Dataset not selected for Load Dataset node.")
                try:
                    dataset = Dataset.objects.get(id=dataset_id)
                except Dataset.DoesNotExist:
                    raise ValueError(f"Dataset with ID {dataset_id} does not exist. Please re-upload or select a valid dataset.")

                df = pd.read_csv(dataset.file.path)
                node_outputs[node_id] = {"dataframe": df.to_dict(orient='list'), "columns": list(df.columns), "column_types": dataset.column_types}
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Loaded dataset: {dataset.name} ({len(df)} rows, {len(df.columns)} cols)", stage=node_type, percent=percent_after)
                continue

            if node_type == 'Encoder':
                import pandas as pd
                from sklearn.preprocessing import OneHotEncoder, LabelEncoder, OrdinalEncoder
            
                df = pd.DataFrame(input_data['dataframe'])
                method = node['data'].get('params', {}).get('method', 'OneHot')
                features = node['data'].get('params', {}).get('features', [])
            
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
                    target_col = node['data'].get('params', {}).get('target_column')
                    if not target_col and 'target_column' in parent_ids:
                        target_col = parent_ids['target_column']
                    if target_col and target_col in df.columns:
                        for col in features:
                            if col in df.columns:
                                means = df.groupby(col)[target_col].transform('mean')
                                df[col] = means
            
                after_cols = len(df.columns)
                node_outputs[node_id] = {"dataframe": df.to_dict(orient='list'), "columns": list(df.columns)}
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(
                    graph.pipeline_id,
                    f"{method} encoding on {', '.join(features)} — columns: {before_cols} → {after_cols}",
                    stage=node_type, percent=percent_after
                )
                continue

            if node_type == 'splitDataset':
                import pandas as pd
                parent_output = input_data
                df = pd.DataFrame(parent_output['dataframe'])
                target_column = node['data'].get('params', {}).get('target_column')
                if not target_column or target_column not in df.columns:
                    raise ValueError(f"Target column '{target_column}' not found in dataset columns: {list(df.columns)}")

                initial_rows = len(df)
                df = df.dropna()
                dropped_rows = initial_rows - len(df)
                if dropped_rows > 0:
                    broadcast(graph.pipeline_id, f"Warning: Removed {dropped_rows} rows containing missing/NaN values.", stage="warning")

                feature_df = df.drop(columns=[target_column])
                numeric_cols = feature_df.select_dtypes(include=['number']).columns.tolist()
                X = feature_df[numeric_cols].values.tolist()
                y = df[target_column].values.tolist()
            
                node_outputs[node_id] = {"X": X, "y": y, "columns": numeric_cols}
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Split dataset on '{target_column}' — features: {len(numeric_cols)}", stage=node_type, percent=percent_after)
                continue

            if node_type == 'predict':
                mode = node['data'].get('params', {}).get('mode', 'test_split')
            
                if mode == 'test_split':
                    preds = input_data.get('predictions', [])
                    actual = input_data.get('y_test', [])
                    node_outputs[node_id] = {"predictions": preds, "actual": actual}
                    percent_after = int(((i + 1) / total_nodes) * 100)
                    preview = ', '.join(str(p) for p in preds[:5])
                    broadcast(graph.pipeline_id, f"Test predictions (first 5): {preview}", stage="predict", percent=percent_after)
                    continue
            
                # ── custom mode ──
                import pickle
                import glob
            
                artifact_dir = f'media/artifacts/{graph_id}'
                model_files = glob.glob(f'{artifact_dir}/model.*')
                if not model_files:
                    raise ValueError("No trained model found — run the training pipeline first.")
            
                model_path = model_files[0]
                feature_values = node['data'].get('params', {}).get('feature_values', {})
                feature_columns = input_data.get('columns', list(feature_values.keys()))
                values = [float(feature_values.get(col, 0)) for col in feature_columns]
            
                if model_path.endswith('.pkl'):
                    with open(model_path, 'rb') as f:
                        model = pickle.load(f)
                else:
                    from tensorflow import keras
                    model = keras.models.load_model(model_path)
            
                scaler_files = glob.glob(f'{artifact_dir}/*.json')
                X_input = [values]
                for sf in scaler_files:
                    with open(sf) as f:
                        sp = json.load(f)
                    if 'mean' in sp and sp['mean']:
                        X_input = [[(v - m) / s if s != 0 else 0 for v, m, s in zip(values, sp['mean'], sp['scale'])]]
                    elif 'data_min' in sp and sp['data_min']:
                        X_input = [[(v - mn) / (mx - mn) if mx != mn else 0 for v, mn, mx in zip(values, sp['data_min'], sp['data_max'])]]
            
                import numpy as np
                prediction = model.predict(np.array(X_input))
                pred_value = prediction.tolist()[0] if hasattr(prediction, 'tolist') else prediction[0]
            
                node_outputs[node_id] = {"prediction": pred_value, "input": dict(zip(feature_columns, values))}
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Prediction: {pred_value}", stage="predict", percent=percent_after)
                continue

            payload = {
                "algorithm_type": node_type,
                "params": node['data'].get('params', {}),
                "input_data": input_data,
            }

            percent_before = int((i / total_nodes) * 100)
            broadcast(
                graph.pipeline_id, f"Running node: {node_type}", stage=node_type, percent=percent_before)

            response = httpx.post(
                f"{FASTAPI_URL}/execute", json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()['result']
            node_outputs[node_id] = result

            # ── save artifacts for THIS node, every iteration ──
            if 'model_b64' in result:
                ext = 'h5' if node_type in [
                    'DenseNN', 'CNN', 'RNN', 'LSTM', 'GRU', 'Autoencoder'] else 'pkl'
                path = f'media/artifacts/{graph_id}/model.{ext}'
                with open(path, 'wb') as f:
                    f.write(base64.b64decode(result['model_b64']))

            if 'scaler_params' in result:
                path = f'media/artifacts/{graph_id}/{node_type}.json'
                with open(path, 'w') as f:
                    json.dump(result['scaler_params'], f)

            percent_after = int(((i + 1) / total_nodes) * 100)
            broadcast(
                graph.pipeline_id, f"Finished node: {node_type}", stage=node_type, percent=percent_after)

        final_output = node_outputs.get(execution_order[-1])
        elapsed = round(time.time() - start_time, 2)

        # ── cache store ───────────────────────────
        set_cached_result(user_id, nodes, edges, final_output)

        graph.status = 'success'
        graph.result = final_output
        graph.node_outputs = node_outputs
        graph.elapsed_seconds = elapsed
        graph.save()

        broadcast(graph.pipeline_id,
                  f"Run complete in {elapsed}s", stage="done", percent=100)

    except httpx.HTTPStatusError as e:
        error_detail = e.response.text if e.response is not None else str(e)
        graph.status = 'failed'
        graph.error = f"FastAPI error: {error_detail}"
        graph.save()
        broadcast(graph.pipeline_id,
                  f"Failed: {error_detail}", stage="error", percent=None)

    except httpx.HTTPError as e:
        graph.status = 'failed'
        graph.error = f"FastAPI call failed: {str(e)}"
        graph.save()
        broadcast(graph.pipeline_id,
                  f"Failed: {str(e)}", stage="error", percent=None)

    except Exception as e:
        graph.status = 'failed'
        graph.error = str(e)
        graph.save()
        broadcast(graph.pipeline_id,
                  f"Failed: {str(e)}", stage="error", percent=None)