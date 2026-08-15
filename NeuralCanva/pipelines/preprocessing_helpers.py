import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder, OneHotEncoder

def run_split_dataset(input_data, params):
    df = pd.DataFrame(input_data.get('dataframe', {}))
    target_column = params.get('target_column')
    test_size = float(params.get('test_size', 0.2))

    initial_rows = len(df)
    df = df.dropna()
    dropped_rows = initial_rows - len(df)

    feature_df = df.drop(columns=[target_column])
    feature_cols = list(feature_df.columns)
    X = feature_df.values.tolist()
    y = df[target_column].values.tolist()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    result = {
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "columns": feature_cols
    }
    return result, dropped_rows, len(X_train), len(X_test), feature_cols


def run_encoder_node(input_data, params):
    method = params.get('method', 'OneHot')
    features = params.get('features', [])
    target_col = params.get('target_column')

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


def topological_sort(nodes, edges):
    node_ids = [n['id'] for n in nodes]
    in_degree = {nid: 0 for nid in node_ids}
    adjacency = {nid: [] for nid in node_ids}

    for edge in edges:
        adjacency[edge['source']].append(edge['target'])
        in_degree[edge['target']] += 1

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
        raise ValueError("Graph has a cycle.")

    return order


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
    elif node_type == 'Embeddings':
        method = ap.get('method')
        features = ap.get('features', [])
        for col in features:
            text_val = str(current_features.pop(col, ""))
            words = text_val.lower().split()
            if method == "SentenceTransformers":
                try:
                    from sentence_transformers import SentenceTransformer
                    m = SentenceTransformer(ap.get('model_name', 'all-MiniLM-L6-v2'))
                    vec = m.encode([text_val])[0].tolist()
                except ImportError:
                    method = "FallbackHash"
            
            if method == "Word2Vec":
                vectors = ap.get('vectors', {})
                vecs = [vectors[w] for w in words if w in vectors]
                if vecs:
                    vec = np.mean(vecs, axis=0).tolist()
                else:
                    vec = np.zeros(50).tolist()
            elif method == "FallbackHash":
                vector_size = ap.get('vector_size', 50)
                vecs = []
                for w in words:
                    state = hash(w)
                    np.random.seed(state % (2**32 - 1))
                    vecs.append(np.random.randn(vector_size))
                if vecs:
                    vec = np.mean(vecs, axis=0).tolist()
                else:
                    vec = np.zeros(vector_size).tolist()
            
            # Append embedding columns to current_features
            for idx, val in enumerate(vec):
                current_features[f"{col}_emb_{idx}"] = val
    return current_features


# ─── EDA & EVALUATION HELPERS ──────────────────────────────────────────────────

def _extract_df(input_data):
    """Safely extracts a pandas DataFrame from various input_data formats."""
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
    """Computes full summary statistics (count, mean, std, min, percentiles, skew, nulls)."""
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
    """Computes correlation matrix for numeric columns."""
    df = _extract_df(input_data)
    if df.empty:
        raise ValueError("Input data is empty.")

    num_df = df.select_dtypes(include=[np.number])
    if num_df.empty:
        raise ValueError("No numerical columns found to compute correlation.")

    method = params.get("method", "pearson")
    corr_matrix = num_df.corr(method=method).replace({np.nan: 0.0}).to_dict()

    result = dict(input_data)
    result.update({
        "correlation_matrix": corr_matrix,
        "numeric_columns": list(num_df.columns),
        "columns": list(df.columns),
    })
    return result


def run_missing_values_node(input_data, params):
    """Detects and optionally handles missing values (drop / impute)."""
    df = _extract_df(input_data)
    strategy = params.get("strategy", "report_only") # 'drop', 'mean', 'median', 'mode', 'constant'

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
    """Generates distribution bins and counts for numerical features."""
    df = _extract_df(input_data)
    target_col = params.get("column") or (df.select_dtypes(include=[np.number]).columns[0] if not df.empty else None)
    bins_count = int(params.get("bins", 10))

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
    """Computes five-number summary and detects outliers for boxplots."""
    df = _extract_df(input_data)
    target_col = params.get("column") or (df.select_dtypes(include=[np.number]).columns[0] if not df.empty else None)

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
    """Evaluates classification or regression metrics from upstream prediction / model results."""
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

    # Detect regression vs classification
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



