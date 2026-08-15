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
