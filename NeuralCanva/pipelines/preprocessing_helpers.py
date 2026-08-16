import os
import json
import base64
import logging
import httpx
import pandas as pd
import numpy as np
from django.conf import settings
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder, OneHotEncoder
from .json_helpers import clean_for_json, sanitize_execution_data

logger = logging.getLogger(__name__)

FASTAPI_URL = os.environ.get(
    "FASTAPI_URL",
    getattr(settings, "FASTAPI_URL", "http://localhost:8001")
)

_http_client = httpx.Client(
    timeout=httpx.Timeout(60.0, connect=10.0),
    limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
)


# ─── GRAPH VALIDATION & TOPOLOGICAL SORT ───────────────────────────────────────

def validate_and_sort_graph(nodes, edges):
    """
    Defensively validates graph structure and returns execution order.
    Checks:
      - Valid node list
      - No duplicate node IDs
      - Edges reference existing source and target nodes
      - No self-loops
      - No cycles (DAG enforcement via Kahn's algorithm)
    """
    if not isinstance(nodes, list) or len(nodes) == 0:
        return []

    node_ids = []
    seen_ids = set()
    for n in nodes:
        if not isinstance(n, dict) or 'id' not in n:
            raise ValueError("Malformed graph: every node must be an object with an 'id'.")
        nid = str(n['id'])
        if nid in seen_ids:
            raise ValueError(f"Duplicate node ID detected: '{nid}'.")
        seen_ids.add(nid)
        node_ids.append(nid)

    in_degree = {nid: 0 for nid in node_ids}
    adjacency = {nid: [] for nid in node_ids}
    seen_edges = set()

    if isinstance(edges, list):
        for e in edges:
            if not isinstance(e, dict) or 'source' not in e or 'target' not in e:
                raise ValueError("Malformed edge: every connection must specify 'source' and 'target'.")
            src = str(e['source'])
            tgt = str(e['target'])

            if src not in in_degree:
                raise ValueError(f"Connection references non-existent source block ID: '{src}'.")
            if tgt not in in_degree:
                raise ValueError(f"Connection references non-existent target block ID: '{tgt}'.")
            if src == tgt:
                raise ValueError(f"Self-loop connection detected on block ID: '{src}'.")

            edge_key = (src, tgt)
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                adjacency[src].append(tgt)
                in_degree[tgt] += 1

    from collections import deque
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
        raise ValueError("Pipeline graph contains a cycle or loop. Connections must flow strictly forward in one direction.")

    return order


def topological_sort(nodes, edges):
    return validate_and_sort_graph(nodes, edges)


# ─── TARGET COLUMN RESOLUTION & SPLIT DATASET ─────────────────────────────────

def resolve_target_column(params):
    """
    Resolves the target column name supporting all common naming conventions.
    """
    if not isinstance(params, dict):
        return None
    for key in ['target_column', 'targetColumn', 'target', 'label_column', 'label', 'target_col']:
        val = params.get(key)
        if val is not None and isinstance(val, str) and val.strip():
            return val.strip()
    return None


def run_split_dataset(input_data, params):
    """
    Splits a tabular dataset into training and testing sets.
    Performs comprehensive validation of input data, target column existence, and split ratio.
    """
    if not input_data or not isinstance(input_data, dict):
        raise ValueError("Split Dataset requires upstream dataset input. Connect and run a Load Dataset block first.")

    raw_df_data = input_data.get('dataframe')
    if raw_df_data is None:
        raise ValueError("No tabular data received by Split Dataset block. Connect a Load Dataset block upstream.")

    df = pd.DataFrame(raw_df_data)
    if df.empty or len(df) == 0:
        raise ValueError("Dataset is empty. Ensure the uploaded CSV contains valid data rows.")

    target_column = resolve_target_column(params)
    if not target_column:
        raise ValueError("Split Dataset requires a target column. Select the column to predict before running the node.")

    if target_column not in df.columns:
        available_cols = list(df.columns)
        cols_preview = ", ".join([f"'{c}'" for c in available_cols[:10]])
        if len(available_cols) > 10:
            cols_preview += f" ... (+{len(available_cols) - 10} more)"
        raise ValueError(f"Target column '{target_column}' was not found in the dataset. Available columns: [{cols_preview}]")

    # Validate test_size
    test_size_raw = params.get('test_size', 0.2) if isinstance(params, dict) else 0.2
    try:
        test_size = float(test_size_raw)
    except (ValueError, TypeError):
        test_size = 0.2

    if not (0.0 < test_size < 1.0):
        test_size = 0.2

    # Validate random_state
    random_state_raw = params.get('random_state', 42) if isinstance(params, dict) else 42
    try:
        random_state = int(random_state_raw)
    except (ValueError, TypeError):
        random_state = 42

    initial_rows = len(df)
    df_clean = df.dropna(subset=[target_column])
    if len(df_clean) == 0:
        raise ValueError(f"All rows in the dataset have missing (NaN) values for target column '{target_column}'.")

    dropped_rows = initial_rows - len(df_clean)

    if len(df_clean) < 2:
        raise ValueError(f"Not enough data rows ({len(df_clean)}) to perform train/test split.")

    feature_df = df_clean.drop(columns=[target_column])
    feature_cols = list(feature_df.columns)
    X = feature_df.values.tolist()
    y = df_clean[target_column].values.tolist()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state
    )

    result = {
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "columns": feature_cols,
        "target_column": target_column,
        "test_size": test_size,
    }
    return result, dropped_rows, len(X_train), len(X_test), feature_cols


# ─── ENCODER NODE ─────────────────────────────────────────────────────────────

def run_encoder_node(input_data, params):
    params = params or {}
    method = params.get('method', 'OneHot')
    features = params.get('features', [])
    target_col = resolve_target_column(params)

    is_split = "X_train" in input_data and "X_test" in input_data

    if is_split:
        columns = input_data.get('columns', [])
        df_train = pd.DataFrame(input_data['X_train'], columns=columns)
        df_test = pd.DataFrame(input_data['X_test'], columns=columns)
        y_train = pd.Series(input_data['y_train'])
        y_test = pd.Series(input_data['y_test'])

        before_cols = len(df_train.columns)
        mappings = {}
        global_mean = 0.0

        if method == 'OneHot':
            valid_feats = [f for f in features if f in df_train.columns]
            if valid_feats:
                encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
                train_encoded = encoder.fit_transform(df_train[valid_feats].astype(str))
                test_encoded = encoder.transform(df_test[valid_feats].astype(str))

                new_cols = encoder.get_feature_names_out(valid_feats).tolist()

                df_train = df_train.drop(columns=valid_feats)
                df_test = df_test.drop(columns=valid_feats)

                for idx, col_name in enumerate(new_cols):
                    df_train[col_name] = train_encoded[:, idx]
                    df_test[col_name] = test_encoded[:, idx]

                for idx, col in enumerate(valid_feats):
                    mappings[col] = encoder.categories_[idx].tolist()

        elif method == 'Label':
            for col in features:
                if col in df_train.columns:
                    le = LabelEncoder()
                    df_train[col] = le.fit_transform(df_train[col].astype(str))
                    train_classes = set(le.classes_)
                    df_test[col] = df_test[col].apply(lambda x: str(x) if str(x) in train_classes else le.classes_[0])
                    df_test[col] = le.transform(df_test[col].astype(str))

                    mappings[col] = {str(cat): float(idx) for idx, cat in enumerate(le.classes_)}

        elif method == 'Ordinal':
            valid_feats = [f for f in features if f in df_train.columns]
            if valid_feats:
                oe = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
                df_train[valid_feats] = oe.fit_transform(df_train[valid_feats].astype(str))
                df_test[valid_feats] = oe.transform(df_test[valid_feats].astype(str))

                for idx, col in enumerate(valid_feats):
                    mappings[col] = {str(cat): float(val) for val, cat in enumerate(oe.categories_[idx])}

        elif method == 'Target':
            global_mean = float(y_train.mean()) if len(y_train) > 0 else 0.0
            for col in features:
                if col in df_train.columns:
                    mean_target = y_train.groupby(df_train[col]).mean()
                    df_train[col] = df_train[col].map(mean_target).fillna(global_mean)
                    df_test[col] = df_test[col].map(mean_target).fillna(global_mean)

                    mappings[col] = {str(cat): float(val) for cat, val in mean_target.items()}

        after_cols = len(df_train.columns)

        result = {
            "X_train": df_train.values.tolist(),
            "X_test": df_test.values.tolist(),
            "y_train": y_train.tolist(),
            "y_test": y_test.tolist(),
            "columns": list(df_train.columns),
            "encoder_params": {
                "method": method,
                "features": features,
                "mappings": mappings,
                "global_mean": global_mean
            }
        }
        return result, before_cols, after_cols

    else:
        df = pd.DataFrame(input_data.get('dataframe', {}))
        before_cols = len(df.columns)
        mappings = {}
        global_mean = 0.0

        if method == 'OneHot':
            valid_feats = [f for f in features if f in df.columns]
            if valid_feats:
                encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
                encoded = encoder.fit_transform(df[valid_feats].astype(str))
                new_cols = encoder.get_feature_names_out(valid_feats).tolist()

                df = df.drop(columns=valid_feats)
                for idx, col_name in enumerate(new_cols):
                    df[col_name] = encoded[:, idx]

                for idx, col in enumerate(valid_feats):
                    mappings[col] = encoder.categories_[idx].tolist()

        elif method == 'Label':
            for col in features:
                if col in df.columns:
                    le = LabelEncoder()
                    df[col] = le.fit_transform(df[col].astype(str))
                    mappings[col] = {str(cat): float(idx) for idx, cat in enumerate(le.classes_)}

        elif method == 'Ordinal':
            valid_feats = [f for f in features if f in df.columns]
            if valid_feats:
                oe = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
                df[valid_feats] = oe.fit_transform(df[valid_feats].astype(str))
                for idx, col in enumerate(valid_feats):
                    mappings[col] = {str(cat): float(val) for val, cat in enumerate(oe.categories_[idx])}

        elif method == 'Target':
            if target_col and target_col in df.columns:
                target_series = df[target_col]
                global_mean = float(target_series.mean())
                for col in features:
                    if col in df.columns:
                        mean_target = target_series.groupby(df[col]).mean()
                        df[col] = df[col].map(mean_target).fillna(global_mean)
                        mappings[col] = {str(cat): float(val) for cat, val in mean_target.items()}

        after_cols = len(df.columns)

        result = {
            "dataframe": df.to_dict(orient='list'),
            "columns": list(df.columns),
            "encoder_params": {
                "method": method,
                "features": features,
                "mappings": mappings,
                "global_mean": global_mean
            }
        }
        return result, before_cols, after_cols


# ─── UNIFIED SINGLE NODE EXECUTION ENGINE ──────────────────────────────────────

def execute_single_node(node, input_data, graph_id=None, nodes=None, edges=None):
    """
    Executes a single pipeline node with full validation and artifact management.
    Returns:
        (result, artifacts_to_save, broadcast_message, stage)
    """
    node_data = node.get('data', {}) if isinstance(node, dict) else {}
    node_type = node_data.get('nodeType', '')
    params = node_data.get('params', {}) or {}
    node_id = str(node.get('id', ''))

    artifacts = {}

    # 1. Flow control markers
    if node_type in ('start', 'end'):
        return input_data or {}, artifacts, f"Executed {node_type.title()} block.", node_type

    # 2. Dataset loading
    if node_type == 'loadDataset':
        from datasets.models import Dataset
        dataset_id = node_data.get('datasetId')
        if not dataset_id:
            raise ValueError("No dataset selected for Load Dataset block. Attach or upload a CSV first.")
        try:
            dataset = Dataset.objects.get(id=dataset_id)
        except Dataset.DoesNotExist:
            raise ValueError(f"Dataset with ID '{dataset_id}' does not exist. Please re-upload or select a valid dataset.")

        # Robust file path resolution across default_storage, direct path, MEDIA_ROOT, and BASE_DIR
        file_path = None
        candidates = []
        if dataset.file:
            try:
                from django.core.files.storage import default_storage
                if hasattr(default_storage, 'path'):
                    try:
                        candidates.append(default_storage.path(dataset.file.name))
                    except Exception:
                        pass
                candidates.append(dataset.file.path)
            except Exception:
                pass
            raw_name = str(dataset.file.name)
            candidates.append(os.path.join(str(settings.MEDIA_ROOT), raw_name))
            candidates.append(os.path.join(str(settings.BASE_DIR), 'media', raw_name))
            candidates.append(os.path.join(str(settings.BASE_DIR), raw_name))

        for cp in candidates:
            if cp and os.path.exists(cp):
                file_path = cp
                break

        if not file_path:
            raise ValueError(
                f"Dataset file '{dataset.name}' could not be found in configured storage. "
                f"Please re-upload or select the dataset in the '{node_data.get('title', 'Load Dataset')}' block."
            )

        df = pd.read_csv(file_path)
        result = {
            "dataframe": df.to_dict(orient='list'),
            "columns": list(df.columns),
            "column_types": dataset.column_types or {}
        }
        return result, artifacts, f"Loaded dataset: {dataset.name} ({len(df)} rows, {len(df.columns)} cols)", node_type

    # 3. Split Dataset
    if node_type == 'splitDataset':
        result, dropped_rows, train_len, test_len, feature_cols = run_split_dataset(input_data, params)
        artifacts['features'] = feature_cols
        warn_msg = f" (Dropped {dropped_rows} NaN rows)" if dropped_rows > 0 else ""
        msg = f"Split dataset on '{result['target_column']}' — train: {train_len} rows, test: {test_len} rows{warn_msg}"
        return result, artifacts, msg, node_type

    # 4. Encoder
    if node_type == 'Encoder':
        result, before_cols, after_cols = run_encoder_node(input_data, params)
        artifacts['node_json'] = result['encoder_params']
        artifacts['features'] = result.get('columns', [])
        msg = f"One-Hot encoding completed. Features: {', '.join(params.get('features', []))}. Columns: {before_cols} → {after_cols}"
        return result, artifacts, msg, node_type

    # 5. EDA & Statistics nodes
    if node_type in ('Describe', 'DescribeStats'):
        result = run_describe_node(input_data, params)
        return result, artifacts, f"Summary statistics computed across {len(result.get('columns', []))} columns.", "Describe"

    if node_type == 'Correlation':
        result = run_correlation_node(input_data, params)
        return result, artifacts, "Correlation matrix calculated for numeric columns.", "Correlation"

    if node_type == 'MissingValues':
        result = run_missing_values_node(input_data, params)
        return result, artifacts, f"Missing values analyzed ({result.get('total_missing_before', 0)} nulls detected).", "MissingValues"

    if node_type == 'Histogram':
        result = run_histogram_node(input_data, params)
        return result, artifacts, f"Histogram computed for column: {result.get('histogram', {}).get('column')}", "Histogram"

    if node_type in ('Boxplot', 'plot'):
        result = run_boxplot_node(input_data, params)
        return result, artifacts, f"Boxplot bounds computed for column: {result.get('boxplot', {}).get('column')}", "Boxplot"

    if node_type == 'evaluate':
        result = run_evaluate_node(input_data, params)
        m = result.get('metrics', {})
        score_str = f"Accuracy: {m.get('accuracy')}" if m.get('task_type') == 'classification' else f"R²: {m.get('r2')}, RMSE: {m.get('rmse')}"
        return result, artifacts, f"Evaluation score — {score_str}", "evaluate"

    # 6. Predict node
    if node_type == 'predict':
        mode = params.get('mode', 'test_split')
        if mode == 'test_split':
            preds = input_data.get('predictions', [])
            actual = input_data.get('y_test', [])
            result = {"predictions": preds, "actual": actual}
            preview = ', '.join(str(p) for p in preds[:5])
            return result, artifacts, f"Test predictions preview (first 5): {preview}", "predict"

        # custom prediction mode
        import glob
        import pickle
        artifact_dir = f'media/artifacts/{graph_id}' if graph_id else 'media/artifacts/temp'
        model_files = glob.glob(f'{artifact_dir}/model.*')
        if not model_files:
            raise ValueError("No trained model found — run the model training block first.")

        model_path = model_files[0]
        feature_values = params.get('feature_values', {})

        features_path = f'{artifact_dir}/features.json'
        if os.path.exists(features_path):
            with open(features_path) as f:
                final_cols = json.load(f)
        else:
            final_cols = list(feature_values.keys())

        if len(feature_values) != len(final_cols):
            raise ValueError(f"Feature count mismatch: model expects {len(final_cols)} features ({', '.join(final_cols)}), but {len(feature_values)} provided.")

        current_features = dict(feature_values)
        if nodes and edges:
            exec_order = validate_and_sort_graph(nodes, edges)
            node_map_dict = {n['id']: n for n in nodes}
            for nid in exec_order:
                if nid == node_id:
                    break
                n = node_map_dict[nid]
                ntype = n.get('data', {}).get('nodeType')
                ap_path = f'{artifact_dir}/{nid}.json'
                if os.path.exists(ap_path):
                    with open(ap_path) as f:
                        ap = json.load(f)
                    current_features = apply_preprocess_step(ntype, ap, current_features)

        values = [float(current_features.get(col, 0.0)) for col in final_cols]

        if model_path.endswith('.pkl'):
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
        else:
            from tensorflow import keras
            model = keras.models.load_model(model_path)

        prediction = model.predict(np.array([values]))
        pred_value = prediction.tolist()[0] if hasattr(prediction, 'tolist') else prediction[0]
        result = {"prediction": pred_value, "input": dict(zip(final_cols, values))}
        return result, artifacts, f"Prediction output: {pred_value}", "predict"

    # 7. FastAPI ML & Preprocessing service calls
    payload = {
        "algorithm_type": node_type,
        "params": params,
        "input_data": input_data,
    }

    try:
        resp = _http_client.post(f"{FASTAPI_URL}/execute", json=payload)
        resp.raise_for_status()
        raw_json = resp.json()
        raw_result = raw_json.get('result', {})
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code if e.response is not None else 500
        if status_code == 502:
            detail = "FastAPI service returned HTTP 502 Bad Gateway"
        elif status_code == 429:
            detail = "FastAPI service returned HTTP 429 Too Many Requests"
        elif status_code == 503:
            detail = "FastAPI service returned HTTP 503 Service Unavailable"
        elif status_code == 504:
            detail = "FastAPI service returned HTTP 504 Gateway Timeout"
        else:
            raw_text = e.response.text if e.response is not None else str(e)
            if "<html" in raw_text.lower() or "<!doctype" in raw_text.lower():
                detail = f"HTTP {status_code} Error"
            else:
                detail = raw_text[:200]
        raise ValueError(f"FastAPI execution error for '{node_type}': {detail}") from e
    except httpx.HTTPError as e:
        raise ValueError(f"FastAPI service unreachable at {FASTAPI_URL}: {str(e)[:200]}") from e

    # Extract binary model artifacts safely before sanitizing
    if 'model_b64' in raw_result and raw_result['model_b64']:
        ext = 'h5' if node_type in ['DenseNN', 'CNN', 'RNN', 'LSTM', 'GRU', 'Autoencoder'] else 'pkl'
        try:
            artifacts['model'] = (ext, base64.b64decode(raw_result['model_b64']))
        except Exception:
            pass

    for pkey in ['scaler_params', 'vectorizer_params', 'encoder_params']:
        if pkey in raw_result:
            artifacts['node_json'] = raw_result[pkey]

    if 'columns' in raw_result:
        artifacts['features'] = raw_result['columns']

    # Produce sanitized result for graph persistence, WebSocket logging, and frontend
    result = sanitize_execution_data(raw_result)

    # Informative ML summary message for frontend logs
    if isinstance(raw_result, dict):
        if 'accuracy' in raw_result:
            acc = float(raw_result['accuracy'])
            prec = float(raw_result.get('precision', 0.0))
            rec = float(raw_result.get('recall', 0.0))
            f1 = float(raw_result.get('f1', 0.0))
            msg = f"{node_type} completed — Accuracy: {acc:.4f}, Precision: {prec:.4f}, Recall: {rec:.4f}, F1: {f1:.4f}"
        elif 'r2' in raw_result or 'mse' in raw_result:
            r2_val = float(raw_result.get('r2', 0.0))
            mse_val = float(raw_result.get('mse', 0.0))
            msg = f"{node_type} completed — R²: {r2_val:.4f}, MSE: {mse_val:.4f}"
        else:
            msg = f"Completed block: {node_type}"
    else:
        msg = f"Completed block: {node_type}"

    return result, artifacts, msg, node_type


def save_node_artifacts(graph_id, node_id, artifacts):
    """Safely saves binary models and JSON feature/scaler parameters to disk."""
    if not graph_id or not artifacts:
        return
    artifact_dir = f'media/artifacts/{graph_id}'
    os.makedirs(artifact_dir, exist_ok=True)

    if 'model' in artifacts:
        ext, binary_data = artifacts['model']
        with open(f'{artifact_dir}/model.{ext}', 'wb') as f:
            f.write(binary_data)

    if 'node_json' in artifacts:
        with open(f'{artifact_dir}/{node_id}.json', 'w') as f:
            json.dump(artifacts['node_json'], f)

    if 'features' in artifacts:
        with open(f'{artifact_dir}/features.json', 'w') as f:
            json.dump(artifacts['features'], f)


# ─── PREPROCESSING & EDA HELPERS ───────────────────────────────────────────────

def _extract_df(input_data):
    if not input_data or not isinstance(input_data, dict):
        return pd.DataFrame()
    if "dataframe" in input_data and input_data["dataframe"]:
        return pd.DataFrame(input_data["dataframe"])
    if "X_train" in input_data and "X_test" in input_data:
        cols = input_data.get("columns", [f"feat_{i}" for i in range(len(input_data["X_train"][0]) if input_data["X_train"] else 0)])
        tr = pd.DataFrame(input_data["X_train"], columns=cols)
        te = pd.DataFrame(input_data["X_test"], columns=cols)
        if "y_train" in input_data and input_data["y_train"]:
            tr["target"] = input_data["y_train"]
        if "y_test" in input_data and input_data["y_test"]:
            te["target"] = input_data["y_test"]
        return pd.concat([tr, te], ignore_index=True)
    if "X" in input_data and input_data["X"]:
        cols = input_data.get("columns", [f"feat_{i}" for i in range(len(input_data["X"][0]) if input_data["X"] else 0)])
        df = pd.DataFrame(input_data["X"], columns=cols)
        if "y" in input_data and input_data["y"]:
            df["target"] = input_data["y"]
        return df
    return pd.DataFrame()


def run_describe_node(input_data, params):
    df = _extract_df(input_data)
    if df.empty:
        raise ValueError("Input data is empty or missing tabular features to describe.")

    desc = df.describe(include='all').replace({np.nan: None}).to_dict()
    column_stats = {}
    for col in df.columns:
        s = df[col]
        column_stats[col] = {
            "dtype": str(s.dtype),
            "null_count": int(s.isnull().sum()),
            "null_pct": round(float(s.isnull().mean() * 100), 2),
            "unique_count": int(s.nunique()),
        }
        if pd.api.types.is_numeric_dtype(s):
            column_stats[col].update({
                "mean": round(float(s.mean()), 4) if not s.isnull().all() else None,
                "std": round(float(s.std()), 4) if len(s) > 1 and not s.isnull().all() else None,
                "min": float(s.min()) if not s.isnull().all() else None,
                "max": float(s.max()) if not s.isnull().all() else None,
                "median": float(s.median()) if not s.isnull().all() else None,
            })

    result = dict(input_data)
    result.update({
        "statistics": desc,
        "column_stats": column_stats,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
    })
    return result


def run_correlation_node(input_data, params):
    df = _extract_df(input_data)
    if df.empty:
        raise ValueError("Input data is empty.")

    num_df = df.select_dtypes(include=[np.number])
    if num_df.empty:
        raise ValueError("No numerical columns found to compute correlation.")

    method = (params or {}).get("method", "pearson")
    corr_matrix = num_df.corr(method=method).replace({np.nan: 0.0}).to_dict()

    result = dict(input_data)
    result.update({
        "correlation_matrix": corr_matrix,
        "numeric_columns": list(num_df.columns),
        "columns": list(df.columns),
    })
    return result


def run_missing_values_node(input_data, params):
    df = _extract_df(input_data)
    strategy = (params or {}).get("strategy", "report_only")

    null_summary = df.isnull().sum().to_dict()
    total_missing = sum(null_summary.values())

    if strategy == "drop":
        df = df.dropna()
    elif strategy in ("mean", "median"):
        for col in df.select_dtypes(include=[np.number]).columns:
            val = df[col].mean() if strategy == "mean" else df[col].median()
            df[col] = df[col].fillna(val)
    elif strategy == "mode":
        for col in df.columns:
            if not df[col].empty:
                mode_val = df[col].mode().iloc[0] if not df[col].mode().empty else 0
                df[col] = df[col].fillna(mode_val)

    result = dict(input_data)
    result.update({
        "dataframe": df.to_dict(orient="list"),
        "columns": list(df.columns),
        "null_summary": null_summary,
        "total_missing_before": total_missing,
        "rows_after": len(df),
    })
    return result


def run_histogram_node(input_data, params):
    df = _extract_df(input_data)
    target_col = (params or {}).get("column") or (df.select_dtypes(include=[np.number]).columns[0] if not df.empty else None)
    bins_count = int((params or {}).get("bins", 10))

    if not target_col or target_col not in df.columns:
        raise ValueError(f"Column '{target_col}' not found for Histogram.")

    series = pd.to_numeric(df[target_col], errors='coerce').dropna()
    counts, bin_edges = np.histogram(series, bins=bins_count)
    bins_data = [
        {"bin": f"{round(bin_edges[i], 2)} - {round(bin_edges[i+1], 2)}", "count": int(counts[i])}
        for i in range(len(counts))
    ]

    result = dict(input_data)
    result.update({
        "histogram": {"column": target_col, "bins": bins_data},
        "columns": list(df.columns),
    })
    return result


def run_boxplot_node(input_data, params):
    df = _extract_df(input_data)
    target_col = (params or {}).get("column") or (df.select_dtypes(include=[np.number]).columns[0] if not df.empty else None)

    if not target_col or target_col not in df.columns:
        raise ValueError(f"Column '{target_col}' not found for Boxplot.")

    series = pd.to_numeric(df[target_col], errors='coerce').dropna()
    q1 = float(series.quantile(0.25))
    median = float(series.median())
    q3 = float(series.quantile(0.75))
    iqr = q3 - q1
    lower_bound = float(q1 - 1.5 * iqr)
    upper_bound = float(q3 + 1.5 * iqr)
    outliers = series[(series < lower_bound) | (series > upper_bound)].tolist()

    result = dict(input_data)
    result.update({
        "boxplot": {
            "column": target_col,
            "min": float(series.min()),
            "q1": q1,
            "median": median,
            "q3": q3,
            "max": float(series.max()),
            "lower_whisker": lower_bound,
            "upper_whisker": upper_bound,
            "outliers_count": len(outliers),
        },
        "columns": list(df.columns),
    })
    return result


def run_evaluate_node(input_data, params):
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        mean_squared_error, mean_absolute_error, r2_score, confusion_matrix
    )
    preds = input_data.get("predictions")
    actual = input_data.get("actual", input_data.get("y_test"))

    if preds is None or actual is None:
        raise ValueError("Evaluation node requires upstream predictions and actual target values.")

    min_len = min(len(preds), len(actual))
    y_p = preds[:min_len]
    y_t = actual[:min_len]

    is_regression = any(isinstance(v, float) and not v.is_integer() for v in y_p[:20] if v is not None)

    metrics = {}
    if is_regression:
        mse = float(mean_squared_error(y_t, y_p))
        metrics = {
            "task_type": "regression",
            "mse": round(mse, 4),
            "rmse": round(float(np.sqrt(mse)), 4),
            "mae": round(float(mean_absolute_error(y_t, y_p)), 4),
            "r2": round(float(r2_score(y_t, y_p)), 4),
        }
    else:
        acc = float(accuracy_score(y_t, y_p))
        metrics = {
            "task_type": "classification",
            "accuracy": round(acc, 4),
            "precision": round(float(precision_score(y_t, y_p, average='weighted', zero_division=0)), 4),
            "recall": round(float(recall_score(y_t, y_p, average='weighted', zero_division=0)), 4),
            "f1": round(float(f1_score(y_t, y_p, average='weighted', zero_division=0)), 4),
            "confusion_matrix": confusion_matrix(y_t, y_p).tolist(),
        }

    result = dict(input_data)
    result["metrics"] = metrics
    return result


def apply_preprocess_step(node_type, ap, current_features):
    import re
    if node_type == 'Encoder':
        method = ap.get('method')
        features = ap.get('features', [])
        mappings = ap.get('mappings', {})
        if method == 'OneHot':
            for col in features:
                val = current_features.pop(col, None)
                cats = mappings.get(col, [])
                for cat in cats:
                    current_features[f"{col}_{cat}"] = 1.0 if str(val) == str(cat) else 0.0
        elif method in ('Label', 'Ordinal'):
            for col in features:
                val = current_features.get(col)
                mapping = mappings.get(col, {})
                current_features[col] = float(mapping.get(str(val), 0.0))
        elif method == 'Target':
            for col in features:
                val = current_features.get(col)
                mapping = mappings.get(col, {})
                global_mean = ap.get('global_mean', 0.0)
                current_features[col] = float(mapping.get(str(val), global_mean))
    elif node_type == 'Vectorizer':
        method = ap.get('method', 'TF-IDF')
        features = ap.get('features', [])
        vocab = ap.get('vocabulary', {})
        idf = ap.get('idf', {})
        for col in features:
            text_val = str(current_features.pop(col, ""))
            tokens = re.findall(r'\b\w+\b', text_val.lower())
            counts = {}
            for t in tokens:
                counts[t] = counts.get(t, 0) + 1
            for word, idx in vocab.items():
                cnt = counts.get(word, 0)
                if method == 'TF-IDF':
                    tf_val = cnt / max(len(tokens), 1)
                    idf_val = idf.get(word, 1.0)
                    current_features[word] = tf_val * idf_val
                else:
                    current_features[word] = float(cnt)
    elif node_type in ('StandardScaler', 'MinMaxScaler', 'RobustScaler', 'MaxAbsScaler', 'Normalizer'):
        cols = ap.get('columns', [])
        mean = ap.get('mean', [])
        scale = ap.get('scale', [])
        data_min = ap.get('data_min', [])
        data_max = ap.get('data_max', [])
        center = ap.get('center', [])

        for idx, col in enumerate(cols):
            if col in current_features:
                val = float(current_features[col])
                if node_type == 'StandardScaler':
                    m = mean[idx]
                    s = scale[idx]
                    current_features[col] = (val - m) / s if s != 0 else 0.0
                elif node_type == 'MinMaxScaler':
                    mn = data_min[idx]
                    mx = data_max[idx]
                    current_features[col] = (val - mn) / (mx - mn) if mx != mn else 0.0
                elif node_type == 'RobustScaler':
                    c = center[idx]
                    s = scale[idx]
                    current_features[col] = (val - c) / s if s != 0 else 0.0
                elif node_type == 'MaxAbsScaler':
                    mx = scale[idx]
                    current_features[col] = val / mx if mx != 0 else 0.0
                elif node_type == 'Normalizer':
                    norm = ap.get('norm', 'l2')
                    vals = [float(current_features.get(c, 0.0)) for c in cols]
                    if norm == 'l2':
                        denom = np.sqrt(sum(v**2 for v in vals))
                    elif norm == 'l1':
                        denom = sum(abs(v) for v in vals)
                    else:
                        denom = max(abs(v) for v in vals)

                    if denom != 0:
                        if col in current_features:
                            current_features[col] = float(current_features[col]) / denom
    return current_features
