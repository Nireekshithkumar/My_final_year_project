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
from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, mean_squared_error, r2_score,
    classification_report, confusion_matrix
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
    "LabelEncoder": LabelEncoder,
}


# ─── EXECUTOR ─────────────────────────────────────────────────────────────────

def execute_algorithm(algorithm_type: str, params: dict, input_data: dict) -> dict:
    """
    Main entry point. Routes to the correct executor based on algorithm_type.
    """
    if algorithm_type in DL_ALGORITHMS:
        return execute_dl(algorithm_type, params, input_data)
    elif algorithm_type in ALGORITHM_REGISTRY:
        return execute_ml(algorithm_type, params, input_data)
    else:
        raise ValueError(f"Unknown algorithm: {algorithm_type}")


# ─── ML EXECUTOR ──────────────────────────────────────────────────────────────
def execute_ml(algorithm_type: str, params: dict, input_data: dict) -> dict:
    X = np.array(input_data['X'])
    y = np.array(input_data['y']) if 'y' in input_data else None

    # split-related params pulled out before passing the rest to the model constructor
    test_size = params.pop('test_size', 0.2)
    stratify_flag = params.pop('stratify', False)

    clf_class = ALGORITHM_REGISTRY[algorithm_type]
    
    # custom column-selection params aren't real sklearn constructor args — extract them first
    selected_columns = params.pop('columns', None)
    
    model = clf_class(**params)

    # clustering / unsupervised
    if algorithm_type in ["KMeans", "DBSCAN", "AgglomerativeClustering"]:
        labels = model.fit_predict(X)
        return {"labels": labels.tolist()}

    # preprocessing
    if algorithm_type in ["StandardScaler", "MinMaxScaler"]:
        all_columns = input_data.get('columns', [])
        X_arr = np.array(X, dtype=float)
    
        if selected_columns and all_columns:
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
                "mean": model.mean_.tolist(),
                "scale": model.scale_.tolist(),
                "columns": selected_columns or all_columns,
            }
        else:
            result["scaler_params"] = {
                "data_min": model.data_min_.tolist(),
                "data_max": model.data_max_.tolist(),
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

    # supervised
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=42,
        stratify=y if stratify_flag else None
    )
    model.fit(X_train, y_train)
   
    
    # after model.fit(X_train, y_train):
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
            return {
                "predictions": predictions.tolist(),
                "mse": mean_squared_error(y_test, predictions),
                "r2": r2_score(y_test, predictions),
                "model_b64": model_b64,
            }
    else:
            return {
                "predictions": predictions.tolist(),
                "accuracy": accuracy_score(y_test, predictions),
                "classification_report": classification_report(y_test, predictions, output_dict=True),
                "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
                "model_b64": model_b64,
        }

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