import joblib
from sklearn.preprocessing import StandardScaler

def apply_scaler(X_train, X_test, config: dict):
    """Fit scaler on train only, transform both. Returns scaled data + the fitted scaler object."""
    if not config.get('use_standard_scaler', False):
        return X_train, X_test, None

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    return X_train_scaled, X_test_scaled, scaler