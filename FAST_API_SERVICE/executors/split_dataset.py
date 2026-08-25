import pandas as pd
from sklearn.model_selection import train_test_split

def run_split_node(file_path: str, config: dict):
    if file_path.lower().endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)
    df.columns = df.columns.astype(str).str.strip()
    target_column = str(config.get('target_column', '')).strip()
    test_size = config.get('test_size', 0.2)
    stratify_flag = config.get('stratify', True)

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' was not found in dataset. Available columns: {list(df.columns)}")

    X = df.drop(columns=[target_column])
    y = df[target_column]

    stratify_arg = y if (stratify_flag and y.nunique() < 20) else None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify_arg
    )
    return X_train, X_test, y_train, y_test