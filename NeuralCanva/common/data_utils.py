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
