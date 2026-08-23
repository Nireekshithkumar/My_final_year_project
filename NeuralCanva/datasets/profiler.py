import numpy as np
import pandas as pd
from common.storage import StorageAbstraction


class DatasetProfiler:
    """
    Advanced Dataset Profiler & Quality Analyzer for NeuralCanvas.
    Generates statistics, data quality scores, target suggestions, data leakage warnings,
    and automatic task type detection.
    """

    @staticmethod
    def profile_dataset(dataset_instance):
        df = StorageAbstraction.read_dataset_df(dataset_instance)
        if df.empty:
            raise ValueError("Dataset contains no rows to profile.")

        total_rows = len(df)
        total_cols = len(df.columns)
        num_cols = list(df.select_dtypes(include=[np.number]).columns)
        cat_cols = list(df.select_dtypes(include=['object', 'category']).columns)
        bool_cols = list(df.select_dtypes(include=['bool']).columns)
        
        # Missing values analysis
        null_counts = df.isnull().sum().to_dict()
        total_missing = int(sum(null_counts.values()))
        missing_pct = round((total_missing / (total_rows * total_cols if total_cols else 1)) * 100, 2)

        # Duplicate rows
        duplicate_rows = int(df.duplicated().sum())
        duplicate_pct = round((duplicate_rows / total_rows) * 100, 2) if total_rows else 0.0

        # Column level profile
        column_profiles = {}
        constant_columns = []
        outliers_detected = {}
        total_outliers_count = 0

        for col in df.columns:
            series = df[col]
            null_count = int(series.isnull().sum())
            unique_count = int(series.nunique(dropna=True))
            dtype_str = str(series.dtype)

            if unique_count <= 1 and total_rows > 1:
                constant_columns.append(col)

            col_prof = {
                "name": col,
                "dtype": dtype_str,
                "type": "numerical" if col in num_cols else ("categorical" if col in cat_cols else ("boolean" if col in bool_cols else "text")),
                "null_count": null_count,
                "null_pct": round((null_count / total_rows) * 100, 2) if total_rows else 0.0,
                "unique_count": unique_count,
            }

            # Outlier detection for numeric columns via IQR
            if col in num_cols:
                clean_s = series.dropna()
                if len(clean_s) > 4:
                    q1 = float(clean_s.quantile(0.25))
                    q3 = float(clean_s.quantile(0.75))
                    iqr = q3 - q1
                    lower_fence = q1 - 1.5 * iqr
                    upper_fence = q3 + 1.5 * iqr
                    outliers = clean_s[(clean_s < lower_fence) | (clean_s > upper_fence)]
                    outlier_count = len(outliers)
                    if outlier_count > 0:
                        outliers_detected[col] = outlier_count
                        total_outliers_count += outlier_count
                    col_prof.update({
                        "min": float(clean_s.min()),
                        "max": float(clean_s.max()),
                        "mean": round(float(clean_s.mean()), 4),
                        "median": round(float(clean_s.median()), 4),
                        "std": round(float(clean_s.std()), 4) if len(clean_s) > 1 else 0.0,
                        "outliers_count": outlier_count,
                    })

            column_profiles[col] = col_prof

        # Memory usage
        memory_bytes = int(df.memory_usage(deep=True).sum())
        memory_mb = round(memory_bytes / (1024 * 1024), 2)

        # ─── Data Quality Score (0 - 100) ───
        # Formula: Base 100 - penalties for missingness, duplicates, outliers, constant columns
        score = 100.0
        # Missing values penalty (up to 30 pts)
        score -= min(30.0, missing_pct * 1.5)
        # Duplicate rows penalty (up to 20 pts)
        score -= min(20.0, duplicate_pct * 2.0)
        # Constant columns penalty (5 pts per constant column, up to 15 pts)
        score -= min(15.0, len(constant_columns) * 5.0)
        # Extreme outliers penalty (up to 15 pts)
        outlier_ratio = (total_outliers_count / (total_rows * len(num_cols) if num_cols else 1))
        score -= min(15.0, outlier_ratio * 100.0 * 0.5)

        data_quality_score = max(10, min(100, int(round(score))))

        # ─── Target Column Suggestions & Task Detection ───
        target_suggestions = DatasetProfiler.suggest_targets(df)
        task_detection = DatasetProfiler.detect_task(df, target_suggestions[0]["column"] if target_suggestions else None)

        return {
            "dataset_id": str(dataset_instance.id),
            "name": dataset_instance.name,
            "total_rows": total_rows,
            "total_columns": total_cols,
            "numerical_columns_count": len(num_cols),
            "categorical_columns_count": len(cat_cols),
            "text_columns_count": len([c for c in df.columns if c not in num_cols and c not in cat_cols and c not in bool_cols]),
            "boolean_columns_count": len(bool_cols),
            "total_missing_values": total_missing,
            "missing_percentage": missing_pct,
            "duplicate_rows": duplicate_rows,
            "duplicate_percentage": duplicate_pct,
            "constant_columns": constant_columns,
            "outliers_summary": outliers_detected,
            "total_outliers_count": total_outliers_count,
            "memory_usage_mb": memory_mb,
            "data_quality_score": data_quality_score,
            "columns": list(df.columns),
            "column_profiles": column_profiles,
            "target_suggestions": target_suggestions,
            "detected_task": task_detection,
        }

    @staticmethod
    def suggest_targets(df):
        """Analyzes columns to score and rank probable target column candidates."""
        candidates = []
        target_keywords = ['target', 'label', 'class', 'price', 'salary', 'income', 'churn', 'status', 'outcome', 'survived', 'y', 'response', 'diagnosis', 'score', 'category', 'risk']

        for idx, col in enumerate(df.columns):
            score = 0.0
            reasons = []
            col_lower = col.lower().strip()
            series = df[col].dropna()
            if series.empty:
                continue

            unique_count = series.nunique()
            total_count = len(series)

            # 1. Column name keywords
            for kw in target_keywords:
                if col_lower == kw:
                    score += 40
                    reasons.append(f"Exact match with standard target keyword '{kw}'")
                    break
                elif kw in col_lower:
                    score += 25
                    reasons.append(f"Contains keyword '{kw}'")
                    break

            # 2. Position bias: Last column in tabular ML datasets is very commonly the target
            if idx == len(df.columns) - 1:
                score += 20
                reasons.append("Last column in dataset")

            # 3. Categorical suitability (2 - 20 distinct classes for classification)
            if 2 <= unique_count <= 20:
                score += 15
                reasons.append(f"Good class cardinality ({unique_count} unique classes)")
                task_suitability = "Classification"
            elif pd.api.types.is_numeric_dtype(series) and unique_count > 20:
                score += 10
                reasons.append("Continuous numeric distribution")
                task_suitability = "Regression"
            else:
                task_suitability = "Unknown"

            # 4. Exclude obvious ID / Index / Timestamp columns from being targets
            if any(id_kw in col_lower for id_kw in ['id', 'uuid', 'index', 'timestamp', 'date', 'created_at', 'url']):
                score -= 30

            if unique_count == total_count and total_count > 10:
                score -= 40  # Unique identifier column

            if score > 0:
                candidates.append({
                    "column": col,
                    "score": round(score, 1),
                    "task_suitability": task_suitability,
                    "unique_classes": unique_count if unique_count <= 20 else None,
                    "reasons": reasons
                })

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates

    @staticmethod
    def detect_task(df, target_col=None):
        """Determines the ML task (Classification, Regression, Clustering, NLP) with confidence."""
        if not target_col or target_col not in df.columns:
            # Check for pure text / NLP dataset
            text_cols = df.select_dtypes(include=['object']).columns
            if len(text_cols) > 0 and any(df[c].astype(str).str.len().mean() > 50 for c in text_cols):
                return {"task": "NLP / Text Processing", "confidence": 88, "reasoning": "High average string length detected across text features."}
            return {"task": "Clustering / Unsupervised", "confidence": 75, "reasoning": "No target column specified. Suitable for unsupervised grouping."}

        series = df[target_col].dropna()
        unique_cnt = series.nunique()

        if pd.api.types.is_bool_dtype(series) or unique_cnt == 2:
            return {"task": "Binary Classification", "confidence": 96, "reasoning": f"Target column '{target_col}' has exactly 2 distinct classes."}
        elif unique_cnt <= 20 or not pd.api.types.is_numeric_dtype(series):
            return {"task": "Multiclass Classification", "confidence": 92, "reasoning": f"Target column '{target_col}' has {unique_cnt} discrete categories."}
        elif pd.api.types.is_numeric_dtype(series):
            return {"task": "Regression", "confidence": 94, "reasoning": f"Target column '{target_col}' is continuous numeric with {unique_cnt} unique values."}
        else:
            return {"task": "Classification", "confidence": 80, "reasoning": f"Defaulting to classification for '{target_col}'."}

    @staticmethod
    def detect_data_leakage(df, target_col):
        """
        Detects potential data leakage where input features have suspicious correlation
        or mathematical identity with the target.
        """
        if not target_col or target_col not in df.columns:
            return []

        warnings = []
        clean_df = df.dropna(subset=[target_col])
        if len(clean_df) < 5:
            return warnings

        target_series = clean_df[target_col]
        # If target is categorical, encode to numeric for correlation check
        if not pd.api.types.is_numeric_dtype(target_series):
            from sklearn.preprocessing import LabelEncoder
            target_numeric = pd.Series(LabelEncoder().fit_transform(target_series.astype(str)), index=clean_df.index)
        else:
            target_numeric = pd.to_numeric(target_series, errors='coerce')

        for col in clean_df.columns:
            if col == target_col:
                continue

            feature_series = clean_df[col]
            if not pd.api.types.is_numeric_dtype(feature_series):
                try:
                    from sklearn.preprocessing import LabelEncoder
                    feature_numeric = pd.Series(LabelEncoder().fit_transform(feature_series.astype(str)), index=clean_df.index)
                except Exception:
                    continue
            else:
                feature_numeric = pd.to_numeric(feature_series, errors='coerce')

            valid_mask = feature_numeric.notnull() & target_numeric.notnull()
            if valid_mask.sum() < 5:
                continue

            try:
                corr = float(np.corrcoef(feature_numeric[valid_mask], target_numeric[valid_mask])[0, 1])
                if not np.isnan(corr) and abs(corr) >= 0.95:
                    warnings.append({
                        "feature": col,
                        "correlation": round(corr, 4),
                        "warning": f"Possible Data Leakage: Feature '{col}' has an extremely high correlation ({round(corr, 4)}) with the target '{target_col}'. It may contain information derived directly from the target."
                    })
            except Exception:
                pass

        return warnings
