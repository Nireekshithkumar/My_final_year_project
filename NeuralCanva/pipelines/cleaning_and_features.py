"""
NeuralCanva Advanced Data Cleaning and Feature Engineering Executors
Provides production-grade implementations for data sanitization, outlier treatment,
resampling, and non-linear feature engineering.
"""

import re
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, List
from common.data_utils import normalize_dataframe_columns

logger = logging.getLogger(__name__)


def _extract_dataframe(input_data: Dict[str, Any]) -> pd.DataFrame:
    """Helper to cleanly extract a DataFrame from upstream node dictionary."""
    if not input_data or not isinstance(input_data, dict):
        return pd.DataFrame()
    if "dataframe" in input_data and input_data["dataframe"]:
        return normalize_dataframe_columns(pd.DataFrame(input_data["dataframe"]))
    if "X_train" in input_data and "X_test" in input_data:
        cols = [str(c).strip() for c in input_data.get("columns", [])]
        tr = pd.DataFrame(input_data["X_train"], columns=cols if cols else None)
        te = pd.DataFrame(input_data["X_test"], columns=cols if cols else None)
        if "y_train" in input_data and input_data["y_train"]:
            tr["target"] = input_data["y_train"]
        if "y_test" in input_data and input_data["y_test"]:
            te["target"] = input_data["y_test"]
        return normalize_dataframe_columns(pd.concat([tr, te], ignore_index=True))
    if "X" in input_data and input_data["X"]:
        cols = [str(c).strip() for c in input_data.get("columns", [])]
        df = pd.DataFrame(input_data["X"], columns=cols if cols else None)
        if "y" in input_data and input_data["y"]:
            df["target"] = input_data["y"]
        return normalize_dataframe_columns(df)
    return pd.DataFrame()


def _format_result(df: pd.DataFrame, extra: Dict[str, Any] = None) -> Dict[str, Any]:
    """Wraps DataFrame into standard NeuralCanva node execution payload."""
    res = {
        "dataframe": df.to_dict(orient='list'),
        "columns": list(df.columns),
        "row_count": len(df),
        "column_count": len(df.columns),
    }
    if extra:
        res.update(extra)
    return res


# ─── DATA CLEANING NODES ───────────────────────────────────────────────────────

def run_remove_duplicates_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Remove Duplicates: upstream data is empty.")

    subset = params.get('subset')
    if isinstance(subset, str) and subset.strip():
        subset = [s.strip() for s in subset.split(',') if s.strip() and s.strip() in df.columns]
    elif isinstance(subset, list):
        subset = [s for s in subset if s in df.columns]
    else:
        subset = None

    keep = params.get('keep', 'first')
    if keep not in ('first', 'last', False):
        keep = 'first'

    before_rows = len(df)
    df_cleaned = df.drop_duplicates(subset=subset, keep=keep)
    dropped = before_rows - len(df_cleaned)

    result = _format_result(df_cleaned, {"dropped_duplicates": dropped})
    msg = f"Removed {dropped} duplicate row(s) (remaining: {len(df_cleaned)} rows)."
    return result, msg


def run_datatype_converter_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Data Type Converter: upstream data is empty.")

    column = params.get('column')
    target_type = params.get('target_type', 'float')
    type_mapping = params.get('type_mapping', {})

    if isinstance(type_mapping, str):
        try:
            import json
            type_mapping = json.loads(type_mapping)
        except Exception:
            type_mapping = {}

    # Support single column or mapping
    if column and column in df.columns:
        type_mapping[column] = target_type

    converted = []
    for col, t in type_mapping.items():
        if col not in df.columns:
            continue
        t_lower = str(t).lower().strip()
        try:
            if 'int' in t_lower:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
            elif 'float' in t_lower or 'numeric' in t_lower:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            elif 'str' in t_lower or 'text' in t_lower:
                df[col] = df[col].astype(str)
            elif 'date' in t_lower or 'time' in t_lower:
                df[col] = pd.to_datetime(df[col], errors='coerce')
            elif 'cat' in t_lower:
                df[col] = df[col].astype('category')
            elif 'bool' in t_lower:
                df[col] = df[col].astype(bool)
            converted.append(f"{col} -> {t_lower}")
        except Exception as e:
            logger.warning(f"Could not convert {col} to {t}: {e}")

    result = _format_result(df, {"converted_types": converted})
    msg = f"Data types converted: {', '.join(converted) if converted else 'no columns modified'}."
    return result, msg


def run_rename_columns_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Rename Columns: upstream data is empty.")

    old_name = params.get('old_name')
    new_name = params.get('new_name')
    rename_mapping = params.get('rename_mapping', {})

    if isinstance(rename_mapping, str):
        try:
            import json
            rename_mapping = json.loads(rename_mapping)
        except Exception:
            rename_mapping = {}

    if old_name and new_name and old_name in df.columns:
        rename_mapping[old_name] = str(new_name).strip()

    valid_mapping = {str(k).strip(): str(v).strip() for k, v in rename_mapping.items() if str(k).strip() in df.columns}
    df = df.rename(columns=valid_mapping)
    df = normalize_dataframe_columns(df)

    result = _format_result(df, {"renamed_columns": valid_mapping})
    msg = f"Renamed {len(valid_mapping)} column(s): {valid_mapping}."
    return result, msg


def run_drop_constant_columns_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Drop Constant Columns: upstream data is empty.")

    constant_cols = [col for col in df.columns if df[col].nunique(dropna=False) <= 1]
    df_cleaned = df.drop(columns=constant_cols)

    result = _format_result(df_cleaned, {"dropped_constant_columns": constant_cols})
    msg = f"Dropped {len(constant_cols)} constant column(s): {', '.join(constant_cols) if constant_cols else 'None'}."
    return result, msg


def run_drop_missing_columns_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Drop Missing Columns: upstream data is empty.")

    threshold = float(params.get('threshold', 0.5))  # Default drop if > 50% missing
    if threshold > 1.0:
        threshold = threshold / 100.0  # normalize percentage if passed as e.g. 50

    missing_ratios = df.isnull().mean()
    drop_cols = missing_ratios[missing_ratios > threshold].index.tolist()
    df_cleaned = df.drop(columns=drop_cols)

    result = _format_result(df_cleaned, {"dropped_missing_columns": drop_cols, "threshold": threshold})
    msg = f"Dropped {len(drop_cols)} column(s) with >{int(threshold*100)}% missing values: {', '.join(drop_cols) if drop_cols else 'None'}."
    return result, msg


def run_outlier_handler_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Outlier Handler: upstream data is empty.")

    columns = params.get('columns', [])
    if isinstance(columns, str) and columns.strip():
        columns = [c.strip() for c in columns.split(',') if c.strip()]
    num_cols = [c for c in (columns or df.select_dtypes(include=[np.number]).columns) if c in df.columns]

    method = params.get('method', 'IQR').upper()
    action = params.get('action', 'clip')  # 'clip', 'remove', 'impute_median'
    threshold = float(params.get('threshold', 1.5 if method == 'IQR' else 3.0))

    total_outliers = 0
    df_result = df.copy()

    if action == 'remove':
        outlier_mask = pd.Series(False, index=df.index)
        for col in num_cols:
            s = df[col].dropna()
            if s.empty:
                continue
            if method == 'IQR':
                q25, q75 = s.quantile(0.25), s.quantile(0.75)
                iqr = q75 - q25
                lower, upper = q25 - threshold * iqr, q75 + threshold * iqr
            else:  # ZScore
                mean, std = s.mean(), s.std()
                if std == 0:
                    continue
                lower, upper = mean - threshold * std, mean + threshold * std
            col_outliers = (df[col] < lower) | (df[col] > upper)
            outlier_mask = outlier_mask | col_outliers
        
        total_outliers = int(outlier_mask.sum())
        df_result = df_result[~outlier_mask].reset_index(drop=True)
        msg = f"Outlier removal ({method}): removed {total_outliers} outlier rows."
    else:
        for col in num_cols:
            s = df[col].dropna()
            if s.empty:
                continue
            if method == 'IQR':
                q25, q75 = s.quantile(0.25), s.quantile(0.75)
                iqr = q75 - q25
                lower, upper = q25 - threshold * iqr, q75 + threshold * iqr
            else:
                mean, std = s.mean(), s.std()
                if std == 0:
                    continue
                lower, upper = mean - threshold * std, mean + threshold * std

            col_mask = (df[col] < lower) | (df[col] > upper)
            total_outliers += int(col_mask.sum())
            if action == 'clip':
                df_result[col] = df_result[col].clip(lower=lower, upper=upper)
            elif action == 'impute_median':
                df_result.loc[col_mask, col] = s.median()

        msg = f"Outliers treated ({method}, {action}): modified {total_outliers} outlier values across {len(num_cols)} columns."

    result = _format_result(df_result, {"total_outliers": total_outliers, "method": method, "action": action})
    return result, msg


def run_rare_category_encoder_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Rare Category Encoder: upstream data is empty.")

    columns = params.get('columns', [])
    if isinstance(columns, str) and columns.strip():
        columns = [c.strip() for c in columns.split(',') if c.strip()]
    cat_cols = [c for c in (columns or df.select_dtypes(include=['object', 'category']).columns) if c in df.columns]

    threshold = float(params.get('threshold', 0.02))  # min 2% frequency
    if threshold > 1.0:
        threshold = threshold / 100.0
    replacement = str(params.get('replacement_label', 'Other'))

    modified_counts = {}
    for col in cat_cols:
        freq = df[col].value_counts(normalize=True)
        rare_labels = freq[freq < threshold].index.tolist()
        if rare_labels:
            df[col] = df[col].apply(lambda x: replacement if x in rare_labels else x)
            modified_counts[col] = len(rare_labels)

    result = _format_result(df, {"rare_category_counts": modified_counts})
    msg = f"Rare category grouping: grouped rare categories (<{int(threshold*100)}%) into '{replacement}' across {len(modified_counts)} columns."
    return result, msg


def run_row_filter_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Row Filter: upstream data is empty.")

    column = params.get('column')
    operator = params.get('operator', '==')
    value = params.get('value')
    before_len = len(df)

    if column and column in df.columns:
        col_series = df[column]
        if operator == 'not_null':
            df = df[col_series.notnull()]
        elif operator == 'is_null':
            df = df[col_series.isnull()]
        else:
            # Type cast value to match column dtype
            try:
                if pd.api.types.is_numeric_dtype(col_series):
                    typed_val = float(value)
                else:
                    typed_val = str(value)

                if operator in ('==', '='):
                    df = df[col_series == typed_val]
                elif operator == '!=':
                    df = df[col_series != typed_val]
                elif operator == '>':
                    df = df[col_series > typed_val]
                elif operator == '>=':
                    df = df[col_series >= typed_val]
                elif operator == '<':
                    df = df[col_series < typed_val]
                elif operator == '<=':
                    df = df[col_series <= typed_val]
                elif operator == 'contains':
                    df = df[col_series.astype(str).str.contains(str(value), na=False)]
            except Exception as e:
                logger.warning(f"Row filter comparison error on column {column}: {e}")

    dropped = before_len - len(df)
    result = _format_result(df, {"filtered_rows": dropped})
    msg = f"Row Filter ({column} {operator} {value}): kept {len(df)} rows (filtered out {dropped} rows)."
    return result, msg


def run_data_balancing_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Data Balancing: upstream data is empty.")

    target_col = params.get('target_column')
    if not target_col or target_col not in df.columns:
        raise ValueError(f"Data Balancing: target column '{target_col}' not found in dataset.")

    method = params.get('method', 'SMOTE')
    random_state = int(params.get('random_state', 42))

    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Only apply numeric features to SMOTE / Resamplers
    num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    if len(num_cols) < len(X.columns):
        # Auto-encode non-numeric columns for balancing
        from sklearn.preprocessing import OrdinalEncoder
        oe = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        non_num = [c for c in X.columns if c not in num_cols]
        X[non_num] = oe.fit_transform(X[non_num].astype(str))

    # Fill NaNs before resampling
    X = X.fillna(X.median(numeric_only=True))

    try:
        if method == 'SMOTE':
            from imblearn.over_sampling import SMOTE
            # Ensure k_neighbors is valid for smallest class
            min_class_count = y.value_counts().min()
            k_neighbors = min(5, max(1, min_class_count - 1))
            resampler = SMOTE(k_neighbors=k_neighbors, random_state=random_state)
            X_res, y_res = resampler.fit_resample(X, y)
        elif method in ('RandomOverSampler', 'oversample'):
            from imblearn.over_sampling import RandomOverSampler
            resampler = RandomOverSampler(random_state=random_state)
            X_res, y_res = resampler.fit_resample(X, y)
        elif method in ('RandomUnderSampler', 'undersample'):
            from imblearn.under_sampling import RandomUnderSampler
            resampler = RandomUnderSampler(random_state=random_state)
            X_res, y_res = resampler.fit_resample(X, y)
        else:
            raise ValueError(f"Unsupported balancing method '{method}'")
    except ImportError:
        # Fallback pure pandas resampling if imbalanced-learn is not installed
        logger.info("Imblearn not found, applying pure pandas random balancing fallback.")
        if method in ('RandomUnderSampler', 'undersample'):
            min_count = y.value_counts().min()
            balanced_dfs = [df[y == label].sample(n=min_count, random_state=random_state) for label in y.unique()]
            df_res = pd.concat(balanced_dfs).sample(frac=1, random_state=random_state).reset_index(drop=True)
            result = _format_result(df_res, {"balanced_rows": len(df_res), "method": method})
            return result, f"Data balanced with Pandas fallback (rows: {len(df)} → {len(df_res)})."
        else:
            max_count = y.value_counts().max()
            balanced_dfs = [df[y == label].sample(n=max_count, replace=True, random_state=random_state) for label in y.unique()]
            df_res = pd.concat(balanced_dfs).sample(frac=1, random_state=random_state).reset_index(drop=True)
            result = _format_result(df_res, {"balanced_rows": len(df_res), "method": method})
            return result, f"Data oversampled with Pandas fallback (rows: {len(df)} → {len(df_res)})."

    df_res = pd.DataFrame(X_res, columns=X.columns)
    df_res[target_col] = y_res.values

    result = _format_result(df_res, {"balanced_rows": len(df_res), "method": method})
    msg = f"Data Balanced ({method}): resampled class distribution (rows: {len(df)} → {len(df_res)})."
    return result, msg


# ─── FEATURE ENGINEERING NODES ─────────────────────────────────────────────────

def run_polynomial_features_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    from sklearn.preprocessing import PolynomialFeatures
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Polynomial Features: upstream data is empty.")

    columns = params.get('columns', [])
    if isinstance(columns, str) and columns.strip():
        columns = [c.strip() for c in columns.split(',') if c.strip()]
    num_cols = [c for c in (columns or df.select_dtypes(include=[np.number]).columns) if c in df.columns]

    degree = int(params.get('degree', 2))
    interaction_only = bool(params.get('interaction_only', False))
    include_bias = bool(params.get('include_bias', False))

    if not num_cols:
        raise ValueError("Polynomial Features: no numeric columns selected.")

    poly = PolynomialFeatures(degree=degree, interaction_only=interaction_only, include_bias=include_bias)
    poly_array = poly.fit_transform(df[num_cols].fillna(0))
    feature_names = poly.get_feature_names_out(num_cols)

    # Sanitize feature names for DataFrame
    poly_df = pd.DataFrame(poly_array, columns=[str(f).replace(' ', '_') for f in feature_names], index=df.index)

    # Drop original subset if newly created features contain them, or merge
    other_cols = [c for c in df.columns if c not in num_cols]
    df_result = pd.concat([df[other_cols], poly_df], axis=1)

    result = _format_result(df_result, {"generated_features": list(poly_df.columns)})
    msg = f"Polynomial Features (deg {degree}): expanded {len(num_cols)} columns → {len(poly_df.columns)} feature terms."
    return result, msg


def run_pca_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    from sklearn.decomposition import PCA
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("PCA: upstream data is empty.")

    columns = params.get('columns', [])
    if isinstance(columns, str) and columns.strip():
        columns = [c.strip() for c in columns.split(',') if c.strip()]
    num_cols = [c for c in (columns or df.select_dtypes(include=[np.number]).columns) if c in df.columns]

    n_components = params.get('n_components', 2)
    try:
        n_components = int(n_components)
    except Exception:
        n_components = 2

    n_components = min(n_components, len(num_cols), len(df))
    pca = PCA(n_components=n_components)
    pca_transformed = pca.fit_transform(df[num_cols].fillna(df[num_cols].median()))

    pca_cols = [f"PCA_Component_{i+1}" for i in range(n_components)]
    pca_df = pd.DataFrame(pca_transformed, columns=pca_cols, index=df.index)

    other_cols = [c for c in df.columns if c not in num_cols]
    df_result = pd.concat([df[other_cols], pca_df], axis=1)

    explained_var = [round(float(v), 4) for v in pca.explained_variance_ratio_]
    result = _format_result(df_result, {
        "n_components": n_components,
        "explained_variance_ratio": explained_var,
        "total_explained_variance": round(float(sum(explained_var)), 4)
    })
    msg = f"PCA ({n_components} components): reduced {len(num_cols)} features (explained variance: {round(sum(explained_var)*100, 1)}%)."
    return result, msg


def run_variance_threshold_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    from sklearn.feature_selection import VarianceThreshold
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Variance Threshold: upstream data is empty.")

    threshold = float(params.get('threshold', 0.0))
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if not num_cols:
        return _format_result(df), "Variance Threshold: no numeric features found."

    selector = VarianceThreshold(threshold=threshold)
    transformed = selector.fit_transform(df[num_cols].fillna(0))
    retained_cols = [num_cols[i] for i, retained in enumerate(selector.get_support()) if retained]
    dropped_cols = [c for c in num_cols if c not in retained_cols]

    other_cols = [c for c in df.columns if c not in num_cols]
    df_result = pd.concat([df[other_cols], pd.DataFrame(transformed, columns=retained_cols, index=df.index)], axis=1)

    result = _format_result(df_result, {"retained_features": retained_cols, "dropped_features": dropped_cols})
    msg = f"Variance Threshold (> {threshold}): retained {len(retained_cols)} columns, dropped {len(dropped_cols)} low-variance features."
    return result, msg


def run_select_kbest_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    from sklearn.feature_selection import SelectKBest, f_classif, f_regression
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("SelectKBest: upstream data is empty.")

    target_col = params.get('target_column')
    if not target_col or target_col not in df.columns:
        raise ValueError("SelectKBest: valid target_column is required.")

    k = int(params.get('k', 5))
    score_func_name = params.get('score_func', 'f_classif')
    score_func = f_classif if score_func_name == 'f_classif' else f_regression

    X = df.drop(columns=[target_col]).select_dtypes(include=[np.number]).fillna(0)
    y = df[target_col]

    k = min(k, len(X.columns))
    selector = SelectKBest(score_func=score_func, k=k)
    X_new = selector.fit_transform(X, y)
    selected_features = [X.columns[i] for i, s in enumerate(selector.get_support()) if s]

    other_cols = [c for c in df.columns if c not in X.columns and c != target_col]
    df_result = pd.concat([df[other_cols], pd.DataFrame(X_new, columns=selected_features, index=df.index), df[[target_col]]], axis=1)

    result = _format_result(df_result, {"selected_features": selected_features})
    msg = f"SelectKBest (k={k}, {score_func_name}): selected top features: {', '.join(selected_features)}."
    return result, msg


def run_rfe_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    from sklearn.feature_selection import RFE
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("RFE: upstream data is empty.")

    target_col = params.get('target_column')
    if not target_col or target_col not in df.columns:
        raise ValueError("RFE: valid target_column is required.")

    n_features = int(params.get('n_features_to_select', 5))
    task_type = params.get('task_type', 'classification')

    X = df.drop(columns=[target_col]).select_dtypes(include=[np.number]).fillna(0)
    y = df[target_col]

    estimator = RandomForestClassifier(n_estimators=30, random_state=42) if task_type == 'classification' else RandomForestRegressor(n_estimators=30, random_state=42)
    n_features = min(n_features, len(X.columns))
    rfe = RFE(estimator=estimator, n_features_to_select=n_features)
    X_new = rfe.fit_transform(X, y)
    selected_features = [X.columns[i] for i, s in enumerate(rfe.get_support()) if s]

    other_cols = [c for c in df.columns if c not in X.columns and c != target_col]
    df_result = pd.concat([df[other_cols], pd.DataFrame(X_new, columns=selected_features, index=df.index), df[[target_col]]], axis=1)

    result = _format_result(df_result, {"selected_features": selected_features})
    msg = f"RFE (selected {n_features} features): {', '.join(selected_features)}."
    return result, msg


def run_log_transform_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Log Transform: upstream data is empty.")

    columns = params.get('columns', [])
    if isinstance(columns, str) and columns.strip():
        columns = [c.strip() for c in columns.split(',') if c.strip()]
    num_cols = [c for c in (columns or df.select_dtypes(include=[np.number]).columns) if c in df.columns]

    method = params.get('method', 'log1p')  # 'log1p', 'sqrt'
    for col in num_cols:
        s = df[col].astype(float)
        if method == 'log1p':
            min_val = s.min()
            offset = abs(min_val) + 1 if min_val < 0 else 0
            df[f"{col}_log1p"] = np.log1p(s + offset)
        elif method == 'sqrt':
            df[f"{col}_sqrt"] = np.sqrt(s.clip(lower=0))

    result = _format_result(df, {"transformed_columns": num_cols, "method": method})
    msg = f"Log transform ({method}) applied across {len(num_cols)} columns."
    return result, msg


def run_discretizer_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    from sklearn.preprocessing import KBinsDiscretizer
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Discretizer: upstream data is empty.")

    columns = params.get('columns', [])
    if isinstance(columns, str) and columns.strip():
        columns = [c.strip() for c in columns.split(',') if c.strip()]
    num_cols = [c for c in (columns or df.select_dtypes(include=[np.number]).columns) if c in df.columns]

    n_bins = int(params.get('n_bins', 5))
    strategy = params.get('strategy', 'quantile')

    if not num_cols:
        raise ValueError("Discretizer: no numeric columns selected.")

    kbd = KBinsDiscretizer(n_bins=n_bins, encode='ordinal', strategy=strategy)
    binned = kbd.fit_transform(df[num_cols].fillna(df[num_cols].median()))

    for i, col in enumerate(num_cols):
        df[f"{col}_bin"] = binned[:, i]

    result = _format_result(df, {"binned_columns": num_cols, "n_bins": n_bins})
    msg = f"Discretized {len(num_cols)} columns into {n_bins} bins ({strategy} strategy)."
    return result, msg


def run_custom_math_features_node(input_data: Dict[str, Any], params: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    df = _extract_dataframe(input_data)
    if df.empty:
        raise ValueError("Custom Math Features: upstream data is empty.")

    new_column = str(params.get('new_column_name', 'new_feature')).strip()
    formula = str(params.get('formula', '')).strip()

    if not formula:
        raise ValueError("Custom Math Features: formula expression is empty.")

    # Safe formula evaluation using pandas eval with sandboxed functions
    try:
        df[new_column] = df.eval(formula)
    except Exception as e:
        raise ValueError(f"Custom Math Features: invalid expression '{formula}': {str(e)}")

    df = normalize_dataframe_columns(df)
    result = _format_result(df, {"new_column": new_column, "formula": formula})
    msg = f"Created new feature '{new_column}' using formula '{formula}'."
    return result, msg
