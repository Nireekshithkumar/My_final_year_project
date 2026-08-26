import logging
import pandas as pd

logger = logging.getLogger(__name__)


class TargetColumnNotFoundError(ValueError):
    """
    Exception raised when a requested target column cannot be resolved in the dataset.
    """
    def __init__(self, target_column: str, available_columns: list):
        self.target_column = str(target_column).strip() if target_column is not None else ""
        self.available_columns = [str(c).strip() for c in (available_columns or [])]
        self.error_code = "TARGET_COLUMN_NOT_FOUND"
        self.message = f"Target column '{self.target_column}' was not found."
        super().__init__(self.message)

    def to_dict(self):
        return {
            "error": self.error_code,
            "message": self.message,
            "available_columns": self.available_columns,
        }


class DuplicateColumnsError(ValueError):
    """
    Exception raised when header whitespace normalization creates duplicate column names.
    """
    def __init__(self, duplicate_columns: list):
        self.duplicate_columns = [str(c).strip() for c in (duplicate_columns or [])]
        self.error_code = "DUPLICATE_COLUMNS_DETECTED"
        self.message = f"Duplicate column names detected after sanitization: {self.duplicate_columns}"
        super().__init__(self.message)

    def to_dict(self):
        return {
            "error": self.error_code,
            "message": self.message,
            "duplicate_columns": self.duplicate_columns,
        }


class UnencodedFeaturesError(ValueError):
    """
    Exception raised when non-numeric text columns reach a scikit-learn estimator.
    """
    def __init__(self, columns: list, message: str = None):
        self.columns = [str(c).strip() for c in (columns or [])]
        self.error_code = "UNENCODED_FEATURES"
        self.message = message or f"Some feature columns still contain text: {', '.join(self.columns)}."
        self.suggestion = "Connect an encoder/date transformer before the model."
        super().__init__(self.message)

    def to_dict(self):
        return {
            "error": self.error_code,
            "message": self.message,
            "columns": self.columns,
            "suggestion": self.suggestion,
        }


def normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes all DataFrame column names by stripping leading/trailing whitespace.
    Ensures that original data values remain untouched.
    Detects and rejects duplicate column names created after stripping with DuplicateColumnsError.
    """
    if df is None or not isinstance(df, pd.DataFrame):
        return df

    # Normalize all column names to stripped strings
    cleaned_columns = df.columns.astype(str).str.strip()
    df.columns = cleaned_columns

    # Detect duplicate column names created after whitespace stripping
    duplicated_mask = df.columns.duplicated(keep=False)
    if duplicated_mask.any():
        duplicate_names = sorted(list(set(df.columns[duplicated_mask])))
        raise DuplicateColumnsError(duplicate_names)

    return df


def sanitize_target_column_name(target_column: any) -> str:
    """
    Safely strips leading/trailing whitespace from target column names.
    """
    if target_column is None:
        return ""
    return str(target_column).strip()


def resolve_target_column(params: dict) -> str:
    """
    Resolves the target column name supporting all common naming conventions.
    Normalizes by stripping leading and trailing whitespace.
    """
    if not isinstance(params, dict):
        return None
    for key in ['target_column', 'targetColumn', 'target', 'label_column', 'label', 'target_col']:
        val = params.get(key)
        if val is not None and isinstance(val, str) and val.strip():
            return val.strip()
    return None


def is_date_series(series: pd.Series) -> bool:
    """
    Checks if a series contains date/datetime strings (e.g. '30-06-2019', '2020-01-01').
    Returns True if at least 70% of non-null values can be parsed as dates.
    """
    if series is None or len(series) == 0:
        return False
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
        return False

    sample = series.dropna().astype(str).str.strip()
    if len(sample) == 0:
        return False
    
    # Quick regex check for common date patterns (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, etc.)
    date_pattern_matches = sample.str.match(r'^\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}')
    if date_pattern_matches.mean() < 0.5:
        return False

    try:
        parsed = pd.to_datetime(sample.iloc[:50], format='mixed', errors='coerce')
        return parsed.notna().mean() >= 0.7
    except Exception:
        return False


def extract_date_features(df: pd.DataFrame, date_columns: list) -> pd.DataFrame:
    """
    Decomposes date-like columns into numerical features: _year, _month, _day, _dayofweek.
    Drops original string date columns to ensure only numeric data is passed to estimators.
    """
    if df is None or not isinstance(df, pd.DataFrame) or not date_columns:
        return df

    df_out = df.copy()
    for col in date_columns:
        if col in df_out.columns:
            try:
                parsed = pd.to_datetime(df_out[col], format='mixed', errors='coerce')
                df_out[f"{col}_year"] = parsed.dt.year.fillna(2000).astype(int)
                df_out[f"{col}_month"] = parsed.dt.month.fillna(1).astype(int)
                df_out[f"{col}_day"] = parsed.dt.day.fillna(1).astype(int)
                df_out[f"{col}_dayofweek"] = parsed.dt.dayofweek.fillna(0).astype(int)
                df_out = df_out.drop(columns=[col])
            except Exception as e:
                logger.warning(f"Could not extract date features for column '{col}': {e}")
    return df_out
