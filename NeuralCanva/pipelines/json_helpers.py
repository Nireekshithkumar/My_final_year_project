import math
import numpy as np
import pandas as pd

def clean_for_json(obj):
    """
    Recursively sanitizes any Python object so it is 100% compliant with standard JSON (RFC 8259).
    Replaces NaN, Infinity, -Infinity with None.
    Converts numpy types and pandas structures to native python primitives.
    """
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (str, int)):
        return obj
    if isinstance(obj, (float, np.floating)):
        try:
            if math.isnan(obj) or math.isinf(obj) or np.isnan(obj) or np.isinf(obj):
                return None
        except Exception:
            return None
        return float(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return [clean_for_json(x) for x in obj.tolist()]
    if isinstance(obj, pd.DataFrame):
        cleaned_df = obj.where(pd.notnull(obj), None)
        return {str(col): [clean_for_json(v) for v in cleaned_df[col].tolist()] for col in cleaned_df.columns}
    if isinstance(obj, pd.Series):
        cleaned_s = obj.where(pd.notnull(obj), None)
        return [clean_for_json(v) for v in cleaned_s.tolist()]
    if isinstance(obj, dict):
        return {str(k): clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [clean_for_json(v) for v in obj]

    # Handle float('nan') or float('inf') disguised in other types
    try:
        if math.isnan(obj) or math.isinf(obj):
            return None
    except Exception:
        pass

    try:
        return str(obj)
    except Exception:
        return None


def sanitize_execution_data(data, max_string_len=500, max_list_len=100):
    """
    Recursively sanitizes execution results, hiding large binary/base64 blobs
    (e.g., model_b64, serialized models) and truncating huge dataset arrays for safe
    logging, WebSocket broadcasting, and JSON serialization.
    """
    if data is None:
        return None
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if k_lower in ('model_b64', 'serialized_model', 'pickle', 'pickle_data', 'joblib_data', 'binary', 'artifact_data'):
                sanitized[k] = "[hidden]"
                if isinstance(v, str) and len(v) > 0:
                    size_kb = (len(v) * 3 / 4) / 1024
                    sanitized['model_size'] = f"{size_kb:.1f} KB"
                    sanitized['model_artifact'] = "saved"
            else:
                sanitized[k] = sanitize_execution_data(v, max_string_len, max_list_len)
        return clean_for_json(sanitized)
    elif isinstance(data, (list, tuple, set)):
        items = list(data)
        if len(items) > max_list_len:
            return [sanitize_execution_data(x, max_string_len, max_list_len) for x in items[:max_list_len]]
        return [sanitize_execution_data(x, max_string_len, max_list_len) for x in items]
    elif isinstance(data, str):
        if len(data) > max_string_len:
            if len(data) > 1000 and data.endswith(('=', '==', 'AAA', 'AA')):
                return "[large base64 blob hidden]"
            return data[:max_string_len] + "... [truncated]"
        return data
    return clean_for_json(data)

