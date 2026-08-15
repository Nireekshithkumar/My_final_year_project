import logging
import httpx
import time
import base64
import os
import json

logger = logging.getLogger(__name__)

from .cache import get_cached_result, set_cached_result
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

FASTAPI_URL = os.environ.get(
    "FASTAPI_URL",
    "http://localhost:8001"
)

from .preprocessing_helpers import (
    run_split_dataset,
    run_encoder_node,
    apply_preprocess_step,
    topological_sort,
)
from .json_helpers import clean_for_json


def broadcast(pipeline_id, message, stage=None, percent=None):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'run_{pipeline_id}_logs',
        {'type': 'log_message', 'message': message,
         'stage': stage, 'percent': percent}
    )


def execute_graph(graph_id):
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
                params = node['data'].get('params', {})
                result, before_cols, after_cols = run_encoder_node(input_data, params)
                
                # Save params to artifact using node_id
                path = f'media/artifacts/{graph_id}/{node_id}.json'
                with open(path, 'w') as f:
                    json.dump(result['encoder_params'], f)
                
                # Save latest column names list to features.json
                with open(f'media/artifacts/{graph_id}/features.json', 'w') as f:
                    json.dump(result.get('columns', []), f)
                
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(
                    graph.pipeline_id,
                    f"One-Hot encoding completed. Features: {', '.join(params.get('features', []))}. Columns: {before_cols} → {after_cols}",
                    stage=node_type, percent=percent_after
                )
                continue

            if node_type in ('Describe', 'DescribeStats'):
                from .preprocessing_helpers import run_describe_node
                result = run_describe_node(input_data, node['data'].get('params', {}))
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Summary statistics computed for {len(result.get('columns', []))} columns", stage="Describe", percent=percent_after)
                continue

            if node_type == 'Correlation':
                from .preprocessing_helpers import run_correlation_node
                result = run_correlation_node(input_data, node['data'].get('params', {}))
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Correlation matrix calculated for numeric columns", stage="Correlation", percent=percent_after)
                continue

            if node_type == 'MissingValues':
                from .preprocessing_helpers import run_missing_values_node
                result = run_missing_values_node(input_data, node['data'].get('params', {}))
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Missing values analyzed ({result.get('total_missing_before', 0)} nulls detected)", stage="MissingValues", percent=percent_after)
                continue

            if node_type == 'Histogram':
                from .preprocessing_helpers import run_histogram_node
                result = run_histogram_node(input_data, node['data'].get('params', {}))
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Histogram distribution computed for {result.get('histogram', {}).get('column')}", stage="Histogram", percent=percent_after)
                continue

            if node_type in ('Boxplot', 'plot'):
                from .preprocessing_helpers import run_boxplot_node
                result = run_boxplot_node(input_data, node['data'].get('params', {}))
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(graph.pipeline_id, f"Boxplot outlier bounds computed for {result.get('boxplot', {}).get('column')}", stage="Boxplot", percent=percent_after)
                continue

            if node_type == 'evaluate':
                from .preprocessing_helpers import run_evaluate_node
                result = run_evaluate_node(input_data, node['data'].get('params', {}))
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                m = result.get('metrics', {})
                score_str = f"Accuracy: {m.get('accuracy')}" if m.get('task_type') == 'classification' else f"R²: {m.get('r2')}, RMSE: {m.get('rmse')}"
                broadcast(graph.pipeline_id, f"Evaluation score — {score_str}", stage="evaluate", percent=percent_after)
                continue

            if node_type == 'splitDataset':
                params = node['data'].get('params', {})
                result, dropped_rows, train_len, test_len, feature_cols = run_split_dataset(input_data, params)
                
                if dropped_rows > 0:
                    broadcast(graph.pipeline_id, f"Warning: Removed {dropped_rows} rows containing missing/NaN values.", stage="warning")
                
                # Save latest column names list to features.json
                with open(f'media/artifacts/{graph_id}/features.json', 'w') as f:
                    json.dump(feature_cols, f)
                
                node_outputs[node_id] = result
                percent_after = int(((i + 1) / total_nodes) * 100)
                broadcast(
                    graph.pipeline_id,
                    f"Split dataset on '{params.get('target_column')}' — train: {train_len} rows, test: {test_len} rows",
                    stage=node_type, percent=percent_after
                )
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
                
                # Load final features list to check order
                features_path = f'{artifact_dir}/features.json'
                if os.path.exists(features_path):
                    with open(features_path) as f:
                        final_cols = json.load(f)
                else:
                    final_cols = list(feature_values.keys())
                
                # Check for feature count mismatch (robustness check!)
                if len(feature_values) != len(final_cols):
                    raise ValueError(f"Feature count mismatch: model expects {len(final_cols)} features, but {len(feature_values)} provided.")
                
                # Preprocess step-by-step
                current_features = dict(feature_values)
                
                # Trace topological order to find preprocess nodes
                exec_order = topological_sort(nodes, edges)
                node_map = {n['id']: n for n in nodes}
                
                for nid in exec_order:
                    if nid == node_id:
                        break
                    n = node_map[nid]
                    ntype = n['data'].get('nodeType')
                    ap_path = f'{artifact_dir}/{nid}.json'
                    if os.path.exists(ap_path):
                        with open(ap_path) as f:
                            ap = json.load(f)
                        current_features = apply_preprocess_step(ntype, ap, current_features)
                
                # Order values by final_cols
                values = [float(current_features.get(col, 0.0)) for col in final_cols]
                
                if model_path.endswith('.pkl'):
                    with open(model_path, 'rb') as f:
                        model = pickle.load(f)
                else:
                    from tensorflow import keras
                    model = keras.models.load_model(model_path)
            
                import numpy as np
                prediction = model.predict(np.array([values]))
                pred_value = prediction.tolist()[0] if hasattr(prediction, 'tolist') else prediction[0]
            
                node_outputs[node_id] = {"prediction": pred_value, "input": dict(zip(final_cols, values))}
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
                path = f'media/artifacts/{graph_id}/{node_id}.json'
                with open(path, 'w') as f:
                    json.dump(result['scaler_params'], f)

            if 'vectorizer_params' in result:
                path = f'media/artifacts/{graph_id}/{node_id}.json'
                with open(path, 'w') as f:
                    json.dump(result['vectorizer_params'], f)

            if 'encoder_params' in result:
                path = f'media/artifacts/{graph_id}/{node_id}.json'
                with open(path, 'w') as f:
                    json.dump(result['encoder_params'], f)

            # Save latest column names list to features.json
            if 'columns' in result:
                with open(f'media/artifacts/{graph_id}/features.json', 'w') as f:
                    json.dump(result['columns'], f)


            percent_after = int(((i + 1) / total_nodes) * 100)
            broadcast(
                graph.pipeline_id, f"Finished node: {node_type}", stage=node_type, percent=percent_after)

        final_output = node_outputs.get(execution_order[-1])
        elapsed = round(time.time() - start_time, 2)

        # ── cache store ───────────────────────────
        set_cached_result(user_id, nodes, edges, final_output)

        graph.status = 'success'
        graph.result = clean_for_json(final_output)
        graph.node_outputs = clean_for_json(node_outputs)
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