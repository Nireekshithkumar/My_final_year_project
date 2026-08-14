import numpy as np
import pandas as pd
from sklearn.linear_model import (
    LinearRegression, LogisticRegression, Ridge, Lasso, ElasticNet
)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    AdaBoostClassifier, BaggingClassifier
)
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB, MultinomialNB
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler, MaxAbsScaler, Normalizer, LabelEncoder
)
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.model_selection import train_test_split, GridSearchCV, RandomizedSearchCV
from sklearn.metrics import (
    accuracy_score, mean_squared_error, r2_score,
    classification_report, confusion_matrix, roc_curve
)
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import logging


import pickle
import base64

import io

logger = logging.getLogger(__name__)


# ─── ALGORITHM REGISTRY ───────────────────────────────────────────────────────

ALGORITHM_REGISTRY = {
    # Classical ML - Classification
    "LogisticRegression": LogisticRegression,
    "DecisionTreeClassifier": DecisionTreeClassifier,
    "RandomForestClassifier": RandomForestClassifier,
    "GradientBoostingClassifier": GradientBoostingClassifier,
    "AdaBoostClassifier": AdaBoostClassifier,
    "BaggingClassifier": BaggingClassifier,
    "SVC": SVC,
    "KNeighborsClassifier": KNeighborsClassifier,
    "GaussianNB": GaussianNB,
    "MultinomialNB": MultinomialNB,

    # Classical ML - Regression
    "LinearRegression": LinearRegression,
    "Ridge": Ridge,
    "Lasso": Lasso,
    "ElasticNet": ElasticNet,
    "DecisionTreeRegressor": DecisionTreeRegressor,
    "RandomForestRegressor": RandomForestRegressor,
    "GradientBoostingRegressor": GradientBoostingRegressor,
    "SVR": SVR,
    "KNeighborsRegressor": KNeighborsRegressor,

    # Clustering
    "KMeans": KMeans,
    "DBSCAN": DBSCAN,
    "AgglomerativeClustering": AgglomerativeClustering,

    # Dimensionality Reduction
    "PCA": PCA,

    # Preprocessing
    "StandardScaler": StandardScaler,
    "MinMaxScaler": MinMaxScaler,
    "RobustScaler": RobustScaler,
    "MaxAbsScaler": MaxAbsScaler,
    "Normalizer": Normalizer,
    "LabelEncoder": LabelEncoder,
    "TfidfVectorizer": TfidfVectorizer,
    "CountVectorizer": CountVectorizer,
}


# ─── EXECUTOR ─────────────────────────────────────────────────────────────────

def execute_algorithm(algorithm_type: str, params: dict, input_data: dict) -> dict:
    """
    Main entry point. Routes to the correct executor based on algorithm_type.
    """
    if algorithm_type in DL_ALGORITHMS:
        return execute_dl(algorithm_type, params, input_data)
    elif algorithm_type in ALGORITHM_REGISTRY or algorithm_type == "HyperparamTuning":
        return execute_ml(algorithm_type, params, input_data)
    else:
        raise ValueError(f"Unknown algorithm: {algorithm_type}")


# ─── ML EXECUTOR ──────────────────────────────────────────────────────────────
def execute_ml(algorithm_type: str, params: dict, input_data: dict) -> dict:
    params = dict(params)  # shallow copy
    include_plots = params.pop('include_plots', False)

    # ── Text Vectorization ──
    if algorithm_type in ["TfidfVectorizer", "CountVectorizer"]:
        vec_class = TfidfVectorizer if algorithm_type == "TfidfVectorizer" else CountVectorizer
        max_feat = params.pop('max_features', 100)
        try:
            max_feat = int(max_feat) if max_feat else 100
        except (ValueError, TypeError):
            max_feat = 100

        features = params.pop('features', [])
        dataframe = input_data.get('dataframe', {})
        if dataframe and features:
            df = pd.DataFrame(dataframe)
            col_name = features[0] if isinstance(features, list) and len(features) > 0 else list(df.columns)[0]
            text_series = df[col_name].fillna("").astype(str)
        else:
            text_series = [str(x) for x in input_data.get('X', [])]

        vec = vec_class(max_features=max_feat)
        X_vec = vec.fit_transform(text_series).toarray()
        feature_names = vec.get_feature_names_out().tolist()

        return {
            "X": X_vec.tolist(),
            "columns": feature_names,
            "y": input_data.get('y'),
            "vectorizer_params": {
                "vocabulary": vec.vocabulary_,
                "feature_names": feature_names,
                "algorithm_type": algorithm_type,
            }
        }

    # ── Hyperparameter Tuning ──
    if algorithm_type == "HyperparamTuning":
        sub_algo = params.get('algorithm', 'RandomForestClassifier')
        search_method = params.get('search_method', 'GridSearch')
        cv_folds = int(params.get('cv_folds', 5))
        param_grid_raw = params.get('param_grid', {})

        if isinstance(param_grid_raw, str):
            import json
            try:
                param_grid = json.loads(param_grid_raw)
            except Exception:
                param_grid = {}
        else:
            param_grid = param_grid_raw or {}

        if not param_grid:
            if sub_algo in ["RandomForestClassifier", "RandomForestRegressor"]:
                param_grid = {"n_estimators": [10, 50], "max_depth": [3, 5, None]}
            elif sub_algo in ["LogisticRegression"]:
                param_grid = {"C": [0.1, 1.0, 10.0]}
            elif sub_algo in ["SVC"]:
                param_grid = {"C": [0.1, 1.0], "kernel": ["linear", "rbf"]}
            else:
                param_grid = {}

        base_clf = ALGORITHM_REGISTRY.get(sub_algo, RandomForestClassifier)()
        X = np.array(input_data['X'])
        y = np.array(input_data['y'])

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        if search_method == 'RandomSearch':
            search = RandomizedSearchCV(base_clf, param_distributions=param_grid, cv=cv_folds, n_iter=5, random_state=42)
        else:
            search = GridSearchCV(base_clf, param_grid=param_grid, cv=cv_folds)

        search.fit(X_train, y_train)
        best_model = search.best_estimator_
        predictions = best_model.predict(X_test)

        model_bytes = pickle.dumps(best_model)
        model_b64 = base64.b64encode(model_bytes).decode('utf-8')

        return {
            "best_params": search.best_params_,
            "best_score": float(search.best_score_),
            "predictions": predictions.tolist(),
            "accuracy": float(accuracy_score(y_test, predictions)),
            "model_b64": model_b64,
        }

    X = np.array(input_data['X'])
    y = np.array(input_data['y']) if 'y' in input_data else None

    # split-related params pulled out before passing the rest to the model constructor
    test_size = params.pop('test_size', 0.2)
    stratify_flag = params.pop('stratify', False)

    clf_class = ALGORITHM_REGISTRY[algorithm_type]
    
    # custom column-selection params aren't real sklearn constructor args — extract them first
    selected_columns = params.pop('columns', None)
    apply_all = params.pop('apply_all', False)
    
    model = clf_class(**params)

    # clustering / unsupervised
    if algorithm_type in ["KMeans", "DBSCAN", "AgglomerativeClustering"]:
        labels = model.fit_predict(X)
        return {"labels": labels.tolist()}

    # preprocessing (Scalers)
    if algorithm_type in ["StandardScaler", "MinMaxScaler", "RobustScaler", "MaxAbsScaler", "Normalizer"]:
        all_columns = input_data.get('columns', [])
        try:
            X_arr = np.array(X, dtype=float)
        except (ValueError, TypeError):
            raise ValueError(f"Non-numeric values found in input dataset for {algorithm_type}. Please run an Encoder or Vectorizer node first.")
    
        if not apply_all and selected_columns and all_columns:
            col_indices = [all_columns.index(c) for c in selected_columns if c in all_columns]
        else:
            col_indices = list(range(X_arr.shape[1]))
    
        model.fit(X_arr[:, col_indices])
        X_arr[:, col_indices] = model.transform(X_arr[:, col_indices])
    
        result = {
            "X": X_arr.tolist(),
            "y": input_data.get('y'),
            "columns": all_columns,
        }
        if algorithm_type == "StandardScaler":
            result["scaler_params"] = {
                "mean": model.mean_.tolist() if hasattr(model, 'mean_') else [],
                "scale": model.scale_.tolist() if hasattr(model, 'scale_') else [],
                "columns": selected_columns or all_columns,
            }
        elif algorithm_type == "MinMaxScaler":
            result["scaler_params"] = {
                "data_min": model.data_min_.tolist() if hasattr(model, 'data_min_') else [],
                "data_max": model.data_max_.tolist() if hasattr(model, 'data_max_') else [],
                "columns": selected_columns or all_columns,
            }
        else:
            result["scaler_params"] = {
                "algorithm": algorithm_type,
                "columns": selected_columns or all_columns,
            }
        return result

    if algorithm_type == "PCA":
        transformed = model.fit_transform(X)
        return {
            "transformed": transformed.tolist(),
            "explained_variance_ratio": model.explained_variance_ratio_.tolist()
        }

    if algorithm_type == "LabelEncoder":
        encoded = model.fit_transform(y)
        return {"encoded": encoded.tolist(), "classes": model.classes_.tolist()}

    # supervised ML models
    try:
        X_float = np.array(X, dtype=float)
    except (ValueError, TypeError):
        raise ValueError(f"Non-numeric features found in input data for {algorithm_type}. Encode or vectorise string/categorical features prior to model fitting.")

    X_train, X_test, y_train, y_test = train_test_split(
        X_float, y,
        test_size=test_size,
        random_state=42,
        stratify=y if stratify_flag else None
    )
    model.fit(X_train, y_train)
   
    model_bytes = pickle.dumps(model)
    model_b64 = base64.b64encode(model_bytes).decode('utf-8')
    predictions = model.predict(X_test)

    # regression metrics
    is_regression = algorithm_type in [
        "LinearRegression", "Ridge", "Lasso", "ElasticNet",
        "DecisionTreeRegressor", "RandomForestRegressor",
        "GradientBoostingRegressor", "SVR", "KNeighborsRegressor"
    ]
    if is_regression:
        res = {
            "predictions": predictions.tolist(),
            "mse": float(mean_squared_error(y_test, predictions)),
            "r2": float(r2_score(y_test, predictions)),
            "model_b64": model_b64,
        }
        if include_plots:
            res["plots"] = {
                "actual": y_test.tolist(),
                "predicted": predictions.tolist(),
                "residuals": (y_test - predictions).tolist()
            }
        return res
    else:
        cm = confusion_matrix(y_test, predictions).tolist()
        res = {
            "predictions": predictions.tolist(),
            "accuracy": float(accuracy_score(y_test, predictions)),
            "classification_report": classification_report(y_test, predictions, output_dict=True),
            "confusion_matrix": cm,
            "model_b64": model_b64,
        }
        if include_plots:
            plot_data = {"confusion_matrix": cm}
            if hasattr(model, 'feature_importances_'):
                plot_data["feature_importances"] = model.feature_importances_.tolist()
            if hasattr(model, 'predict_proba') and len(np.unique(y_test)) == 2:
                probs = model.predict_proba(X_test)[:, 1]
                fpr, tpr, _ = roc_curve(y_test, probs)
                plot_data["roc_curve"] = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
            res["plots"] = plot_data
        return res

# ─── DL ALGORITHMS ────────────────────────────────────────────────────────────

DL_ALGORITHMS = [
    "DenseNN",
    "CNN",
    "RNN",
    "LSTM",
    "GRU",
    "Autoencoder",
]


def execute_dl(algorithm_type: str, params: dict, input_data: dict) -> dict:
    X = np.array(input_data['X'])
    y = np.array(input_data['y']) if 'y' in input_data else None

    model = build_dl_model(algorithm_type, params, input_shape=X.shape[1:])

    model.compile(
        optimizer=params.get('optimizer', 'adam'),
        loss=params.get('loss', 'sparse_categorical_crossentropy'),
        metrics=['accuracy']
    )

    history = model.fit(
        X, y,
        epochs=params.get('epochs', 10),
        batch_size=params.get('batch_size', 32),
        validation_split=0.2,
        verbose=0
    )
    

    buffer = io.BytesIO()
    model.save(buffer, save_format='h5')
    model_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')    
    return {
        "final_accuracy": history.history['accuracy'][-1],
        "final_val_accuracy": history.history['val_accuracy'][-1],
        "final_loss": history.history['loss'][-1],
        "epochs_run": len(history.history['accuracy']),
        "model_b64": model_b64,
    }


def build_dl_model(algorithm_type: str, params: dict, input_shape: tuple) -> keras.Model:
    units = params.get('units', 128)
    dropout = params.get('dropout', 0.2)
    num_classes = params.get('num_classes', 10)

    model = keras.Sequential()

    if algorithm_type == "DenseNN":
        model.add(layers.Input(shape=input_shape))
        model.add(layers.Dense(units, activation='relu'))
        model.add(layers.Dropout(dropout))
        model.add(layers.Dense(units // 2, activation='relu'))
        model.add(layers.Dense(num_classes, activation='softmax'))

    elif algorithm_type == "CNN":
        model.add(layers.Input(shape=input_shape))
        model.add(layers.Conv2D(32, (3, 3), activation='relu'))
        model.add(layers.MaxPooling2D())
        model.add(layers.Conv2D(64, (3, 3), activation='relu'))
        model.add(layers.GlobalAveragePooling2D())
        model.add(layers.Dense(num_classes, activation='softmax'))

    elif algorithm_type in ["RNN", "LSTM", "GRU"]:
        model.add(layers.Input(shape=input_shape))
        rnn_layer = {
            "RNN": layers.SimpleRNN,
            "LSTM": layers.LSTM,
            "GRU": layers.GRU
        }[algorithm_type]
        model.add(rnn_layer(units, return_sequences=False))
        model.add(layers.Dropout(dropout))
        model.add(layers.Dense(num_classes, activation='softmax'))

    elif algorithm_type == "Autoencoder":
        model.add(layers.Input(shape=input_shape))
        model.add(layers.Dense(units, activation='relu'))
        model.add(layers.Dense(units // 4, activation='relu'))       # bottleneck
        model.add(layers.Dense(units, activation='relu'))
        model.add(layers.Dense(input_shape[0], activation='sigmoid'))  # reconstruct

    return model