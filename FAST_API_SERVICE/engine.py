import numpy as np
import pandas as pd
from sklearn.linear_model import (
    LinearRegression, LogisticRegression, Ridge, Lasso, ElasticNet,
    Perceptron, SGDClassifier, PassiveAggressiveClassifier
)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    AdaBoostClassifier, BaggingClassifier,
    ExtraTreesClassifier, ExtraTreesRegressor
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
    accuracy_score, mean_squared_error, mean_absolute_error, r2_score,
    explained_variance_score, precision_score, recall_score, f1_score,
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

try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False


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
    "ExtraTreesClassifier": ExtraTreesClassifier,
    "Perceptron": Perceptron,
    "SGDClassifier": SGDClassifier,
    "PassiveAggressiveClassifier": PassiveAggressiveClassifier,

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
    "ExtraTreesRegressor": ExtraTreesRegressor,

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

if HAS_XGB:
    ALGORITHM_REGISTRY["XGBClassifier"] = XGBClassifier
    ALGORITHM_REGISTRY["XGBRegressor"] = XGBRegressor
if HAS_LGBM:
    ALGORITHM_REGISTRY["LGBMClassifier"] = LGBMClassifier
    ALGORITHM_REGISTRY["LGBMRegressor"] = LGBMRegressor



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
    is_split = "X_train" in input_data and "X_test" in input_data

    # ── Text Vectorization ──
    if algorithm_type in ["TfidfVectorizer", "CountVectorizer"]:
        vec_class = TfidfVectorizer if algorithm_type == "TfidfVectorizer" else CountVectorizer
        max_feat = params.pop('max_features', 100)
        try:
            max_feat = int(max_feat) if max_feat else 100
        except (ValueError, TypeError):
            max_feat = 100

        features = params.pop('features', [])
        all_columns = input_data.get('columns', [])

        if "dataframe" in input_data and features:
            df = pd.DataFrame(input_data["dataframe"])
            col_name = features[0] if isinstance(features, list) and len(features) > 0 else list(df.columns)[0]
            text_series = df[col_name].fillna("").astype(str)
            vec = vec_class(max_features=max_feat)
            X_vec = vec.fit_transform(text_series).toarray()
            feature_names = vec.get_feature_names_out().tolist()
            
            df = df.drop(columns=[col_name])
            for i, fname in enumerate(feature_names):
                df[f"{col_name}_{fname}"] = X_vec[:, i]
            
            result = {
                "dataframe": df.to_dict(orient='list'),
                "columns": list(df.columns),
                "vectorizer_params": {
                    "method": "TF-IDF" if algorithm_type == "TfidfVectorizer" else "Count",
                    "features": [col_name],
                    "vocabulary": vec.vocabulary_,
                    "idf": dict(zip(vec.get_feature_names_out(), vec.idf_.tolist())) if hasattr(vec, 'idf_') else {},
                }
            }
            return result
        elif is_split and features and all_columns:
            col_name = features[0]
            col_idx = all_columns.index(col_name) if col_name in all_columns else 0
            
            X_train = input_data["X_train"]
            X_test = input_data["X_test"]
            
            train_text = [str(row[col_idx]) for row in X_train]
            test_text = [str(row[col_idx]) for row in X_test]
            
            vec = vec_class(max_features=max_feat)
            train_vec = vec.fit_transform(train_text).toarray()
            test_vec = vec.transform(test_text).toarray()
            
            feature_names = [f"{col_name}_{fn}" for fn in vec.get_feature_names_out().tolist()]
            
            new_X_train = []
            for idx, row in enumerate(X_train):
                new_row = [v for i, v in enumerate(row) if i != col_idx] + train_vec[idx].tolist()
                new_X_train.append(new_row)
                
            new_X_test = []
            for idx, row in enumerate(X_test):
                new_row = [v for i, v in enumerate(row) if i != col_idx] + test_vec[idx].tolist()
                new_X_test.append(new_row)
                
            new_columns = [c for i, c in enumerate(all_columns) if i != col_idx] + feature_names
            
            result = {
                "X_train": new_X_train,
                "X_test": new_X_test,
                "y_train": input_data.get("y_train"),
                "y_test": input_data.get("y_test"),
                "columns": new_columns,
                "vectorizer_params": {
                    "method": "TF-IDF" if algorithm_type == "TfidfVectorizer" else "Count",
                    "features": [col_name],
                    "vocabulary": vec.vocabulary_,
                    "idf": dict(zip(vec.get_feature_names_out(), vec.idf_.tolist())) if hasattr(vec, 'idf_') else {},
                }
            }
            return result
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
                    "method": "TF-IDF" if algorithm_type == "TfidfVectorizer" else "Count",
                    "features": [],
                    "vocabulary": vec.vocabulary_,
                    "idf": dict(zip(vec.get_feature_names_out(), vec.idf_.tolist())) if hasattr(vec, 'idf_') else {},
                }
            }

    # ── Embeddings Node ──
    if algorithm_type == "Embeddings":
        method = params.get('method', 'Word2Vec')
        features = params.get('features', [])
        all_columns = input_data.get('columns', [])

        if not features and all_columns:
            features = [all_columns[0]]
        if not features:
            raise ValueError("No text features selected for Embeddings node.")
        col_name = features[0]

        def compute_embeddings(texts, method_name):
            if method_name == "SentenceTransformers":
                try:
                    from sentence_transformers import SentenceTransformer
                    m = SentenceTransformer('all-MiniLM-L6-v2')
                    return m.encode(texts).tolist(), {"method": "SentenceTransformers", "model_name": "all-MiniLM-L6-v2"}
                except ImportError:
                    pass
            if method_name == "Word2Vec":
                try:
                    from gensim.models import Word2Vec
                    tokenized = [t.lower().split() for t in texts]
                    w2v = Word2Vec(sentences=tokenized, vector_size=50, window=5, min_count=1, workers=1)
                    embeddings = []
                    for t in tokenized:
                        vecs = [w2v.wv[w] for w in t if w in w2v.wv]
                        if vecs:
                            embeddings.append(np.mean(vecs, axis=0).tolist())
                        else:
                            embeddings.append(np.zeros(50).tolist())
                    return embeddings, {
                        "method": "Word2Vec",
                        "vectors": {w: w2v.wv[w].tolist() for w in w2v.wv.index_to_key}
                    }
                except ImportError:
                    pass
            
            embeddings = []
            vector_size = 50
            for t in texts:
                words = t.lower().split()
                if not words:
                    embeddings.append(np.zeros(vector_size).tolist())
                    continue
                vecs = []
                for w in words:
                    state = hash(w)
                    np.random.seed(state % (2**32 - 1))
                    vecs.append(np.random.randn(vector_size))
                embeddings.append(np.mean(vecs, axis=0).tolist())
            return embeddings, {
                "method": "FallbackHash",
                "vector_size": vector_size
            }

        if "dataframe" in input_data:
            df = pd.DataFrame(input_data["dataframe"])
            text_series = df[col_name].fillna("").astype(str).tolist()
            embeddings_list, emb_params = compute_embeddings(text_series, method)
            
            df = df.drop(columns=[col_name])
            vector_size = len(embeddings_list[0]) if embeddings_list else 50
            for i in range(vector_size):
                df[f"{col_name}_emb_{i}"] = [row[i] for row in embeddings_list]
                
            return {
                "dataframe": df.to_dict(orient='list'),
                "columns": list(df.columns),
                "encoder_params": {
                    "method": emb_params["method"],
                    "features": [col_name],
                    **emb_params
                }
            }
        elif is_split and all_columns:
            col_idx = all_columns.index(col_name)
            X_train = input_data["X_train"]
            X_test = input_data["X_test"]
            train_texts = [str(row[col_idx]) for row in X_train]
            test_texts = [str(row[col_idx]) for row in X_test]
            
            train_emb, emb_params = compute_embeddings(train_texts, method)
            
            if emb_params["method"] == "SentenceTransformers":
                from sentence_transformers import SentenceTransformer
                m = SentenceTransformer(emb_params["model_name"])
                test_emb = m.encode(test_texts).tolist()
            elif emb_params["method"] == "Word2Vec":
                vectors = emb_params["vectors"]
                test_emb = []
                for t in test_texts:
                    words = t.lower().split()
                    vecs = [vectors[w] for w in words if w in vectors]
                    if vecs:
                        test_emb.append(np.mean(vecs, axis=0).tolist())
                    else:
                        test_emb.append(np.zeros(50).tolist())
            else: # FallbackHash
                vector_size = emb_params["vector_size"]
                test_emb = []
                for t in test_texts:
                    words = t.lower().split()
                    vecs = []
                    for w in words:
                        state = hash(w)
                        np.random.seed(state % (2**32 - 1))
                        vecs.append(np.random.randn(vector_size))
                    if vecs:
                        test_emb.append(np.mean(vecs, axis=0).tolist())
                    else:
                        test_emb.append(np.zeros(vector_size).tolist())
                        
            vector_size = len(train_emb[0]) if train_emb else 50
            feature_names = [f"{col_name}_emb_{i}" for i in range(vector_size)]
            
            new_X_train = []
            for idx, row in enumerate(X_train):
                new_row = [v for i, v in enumerate(row) if i != col_idx] + train_emb[idx]
                new_X_train.append(new_row)
                
            new_X_test = []
            for idx, row in enumerate(X_test):
                new_row = [v for i, v in enumerate(row) if i != col_idx] + test_emb[idx]
                new_X_test.append(new_row)
                
            new_columns = [c for i, c in enumerate(all_columns) if i != col_idx] + feature_names
            
            return {
                "X_train": new_X_train,
                "X_test": new_X_test,
                "y_train": input_data.get("y_train"),
                "y_test": input_data.get("y_test"),
                "columns": new_columns,
                "encoder_params": {
                    "method": emb_params["method"],
                    "features": [col_name],
                    **emb_params
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
        
        if is_split:
            X_train = np.array(input_data['X_train'], dtype=float)
            X_test = np.array(input_data['X_test'], dtype=float)
            y_train = np.array(input_data['y_train'])
            y_test = np.array(input_data['y_test'])
        else:
            X = np.array(input_data['X'], dtype=float)
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

        if sub_algo.endswith("Classifier") or sub_algo in ["SVC", "LogisticRegression", "GaussianNB", "MultinomialNB"]:
            cm = confusion_matrix(y_test, predictions).tolist()
            acc = float(accuracy_score(y_test, predictions))
            prec = float(precision_score(y_test, predictions, average='weighted', zero_division=0))
            rec = float(recall_score(y_test, predictions, average='weighted', zero_division=0))
            f1_val = float(f1_score(y_test, predictions, average='weighted', zero_division=0))
            report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
            return {
                "best_params": search.best_params_,
                "best_score": float(search.best_score_),
                "predictions": predictions.tolist(),
                "accuracy": acc,
                "precision": prec,
                "recall": rec,
                "f1": f1_val,
                "confusion_matrix": cm,
                "classification_report": report,
                "metrics": {
                    "task_type": "classification",
                    "accuracy": acc,
                    "precision": prec,
                    "recall": rec,
                    "f1": f1_val,
                    "confusion_matrix": cm,
                    "classification_report": report,
                },
                "plots": {"confusion_matrix": cm},
                "model_b64": model_b64,
                "y_test": y_test.tolist(),
            }
        else:
            mse_val = float(mean_squared_error(y_test, predictions))
            rmse_val = float(np.sqrt(mse_val))
            mae_val = float(mean_absolute_error(y_test, predictions))
            r2_val = float(r2_score(y_test, predictions))
            return {
                "best_params": search.best_params_,
                "best_score": float(search.best_score_),
                "predictions": predictions.tolist(),
                "r2": r2_val,
                "mse": mse_val,
                "rmse": rmse_val,
                "mae": mae_val,
                "metrics": {
                    "task_type": "regression",
                    "r2": r2_val,
                    "mse": mse_val,
                    "rmse": rmse_val,
                    "mae": mae_val,
                },
                "plots": {
                    "actual": y_test.tolist(),
                    "predicted": predictions.tolist(),
                    "residuals": (y_test - predictions).tolist()
                },
                "model_b64": model_b64,
                "y_test": y_test.tolist(),
            }

    # Custom column-selection params aren't real sklearn constructor args — extract them first
    selected_columns = params.pop('columns', None)
    apply_all = params.pop('apply_all', False)
    
    # split-related params pulled out before passing the rest to the model constructor
    test_size = params.pop('test_size', 0.2)
    stratify_flag = params.pop('stratify', False)

    clf_class = ALGORITHM_REGISTRY[algorithm_type]
    model = clf_class(**params)

    # Preprocessing (Scalers)
    if algorithm_type in ["StandardScaler", "MinMaxScaler", "RobustScaler", "MaxAbsScaler", "Normalizer"]:
        all_columns = input_data.get('columns', [])
        
        if is_split:
            X_train = np.array(input_data['X_train'])
            X_test = np.array(input_data['X_test'])
            try:
                X_train_arr = np.array(X_train, dtype=float)
                X_test_arr = np.array(X_test, dtype=float)
            except (ValueError, TypeError):
                raise ValueError(f"Non-numeric values found in input dataset for {algorithm_type}. Please run an Encoder or Vectorizer node first.")
        else:
            X = input_data.get('X', [])
            try:
                X_arr = np.array(X, dtype=float)
            except (ValueError, TypeError):
                raise ValueError(f"Non-numeric values found in input dataset for {algorithm_type}. Please run an Encoder or Vectorizer node first.")

        if not apply_all and selected_columns and all_columns:
            col_indices = [all_columns.index(c) for c in selected_columns if c in all_columns]
        else:
            if is_split:
                col_indices = list(range(X_train_arr.shape[1]))
            else:
                col_indices = list(range(X_arr.shape[1]))

        # Fit model on training split only, transform both
        if is_split:
            model.fit(X_train_arr[:, col_indices])
            X_train_arr[:, col_indices] = model.transform(X_train_arr[:, col_indices])
            X_test_arr[:, col_indices] = model.transform(X_test_arr[:, col_indices])
            result = {
                "X_train": X_train_arr.tolist(),
                "X_test": X_test_arr.tolist(),
                "y_train": input_data.get('y_train'),
                "y_test": input_data.get('y_test'),
                "columns": all_columns,
            }
        else:
            model.fit(X_arr[:, col_indices])
            X_arr[:, col_indices] = model.transform(X_arr[:, col_indices])
            result = {
                "X": X_arr.tolist(),
                "y": input_data.get('y'),
                "columns": all_columns,
            }

        # Export params
        scaler_dict = {
            "columns": selected_columns or all_columns if not apply_all else all_columns,
        }
        if algorithm_type == "StandardScaler":
            scaler_dict["mean"] = model.mean_.tolist() if hasattr(model, 'mean_') else []
            scaler_dict["scale"] = model.scale_.tolist() if hasattr(model, 'scale_') else []
        elif algorithm_type == "MinMaxScaler":
            scaler_dict["data_min"] = model.data_min_.tolist() if hasattr(model, 'data_min_') else []
            scaler_dict["data_max"] = model.data_max_.tolist() if hasattr(model, 'data_max_') else []
        elif algorithm_type == "RobustScaler":
            scaler_dict["center"] = model.center_.tolist() if hasattr(model, 'center_') else []
            scaler_dict["scale"] = model.scale_.tolist() if hasattr(model, 'scale_') else []
        elif algorithm_type == "MaxAbsScaler":
            scaler_dict["scale"] = model.scale_max_abs_.tolist() if hasattr(model, 'scale_max_abs_') else []
        elif algorithm_type == "Normalizer":
            scaler_dict["norm"] = params.get('norm', 'l2')
            
        result["scaler_params"] = scaler_dict
        return result

    # clustering / unsupervised
    if algorithm_type in ["KMeans", "DBSCAN", "AgglomerativeClustering"]:
        X = np.array(input_data['X'])
        labels = model.fit_predict(X)
        return {"labels": labels.tolist()}

    if algorithm_type == "PCA":
        if is_split:
            X_train = np.array(input_data['X_train'])
            X_test = np.array(input_data['X_test'])
            model.fit(X_train)
            result = {
                "X_train": model.transform(X_train).tolist(),
                "X_test": model.transform(X_test).tolist(),
                "y_train": input_data.get('y_train'),
                "y_test": input_data.get('y_test'),
                "explained_variance_ratio": model.explained_variance_ratio_.tolist()
            }
            return result
        else:
            X = np.array(input_data['X'])
            transformed = model.fit_transform(X)
            return {
                "transformed": transformed.tolist(),
                "explained_variance_ratio": model.explained_variance_ratio_.tolist()
            }

    if algorithm_type == "LabelEncoder":
        y = np.array(input_data['y']) if 'y' in input_data else None
        encoded = model.fit_transform(y)
        return {"encoded": encoded.tolist(), "classes": model.classes_.tolist()}

    # Supervised ML Models fitting block
    if is_split:
        try:
            X_train = np.array(input_data['X_train'], dtype=float)
            X_test = np.array(input_data['X_test'], dtype=float)
        except (ValueError, TypeError):
            raise ValueError(f"Non-numeric features found in input data for {algorithm_type}. Encode or vectorise string/categorical features prior to model fitting.")
        y_train = np.array(input_data['y_train'])
        y_test = np.array(input_data['y_test'])
    else:
        X = np.array(input_data['X'])
        y = np.array(input_data['y']) if 'y' in input_data else None
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
        "GradientBoostingRegressor", "SVR", "KNeighborsRegressor",
        "ExtraTreesRegressor", "XGBRegressor", "LGBMRegressor"
    ]
    if is_regression:
        mse_val = float(mean_squared_error(y_test, predictions))
        rmse_val = float(np.sqrt(mse_val))
        mae_val = float(mean_absolute_error(y_test, predictions))
        r2_val = float(r2_score(y_test, predictions))
        try:
            exp_var = float(explained_variance_score(y_test, predictions))
        except Exception:
            exp_var = r2_val

        # MAPE calculation
        try:
            non_zero = y_test != 0
            if np.any(non_zero):
                mape_val = float(np.mean(np.abs((y_test[non_zero] - predictions[non_zero]) / y_test[non_zero])) * 100)
            else:
                mape_val = 0.0
        except Exception:
            mape_val = 0.0

        plots_data = {
            "actual": y_test.tolist(),
            "predicted": predictions.tolist(),
            "residuals": (y_test - predictions).tolist()
        }
        if hasattr(model, 'feature_importances_'):
            plots_data["feature_importances"] = model.feature_importances_.tolist()
        elif hasattr(model, 'coef_'):
            coefs = model.coef_
            plots_data["feature_importances"] = np.abs(coefs).tolist() if hasattr(coefs, 'tolist') else [float(c) for c in coefs]

        metrics_obj = {
            "task_type": "regression",
            "r2": r2_val,
            "mse": mse_val,
            "rmse": rmse_val,
            "mae": mae_val,
            "mape": mape_val,
            "explained_variance": exp_var,
        }

        res = {
            "predictions": predictions.tolist(),
            "r2": r2_val,
            "mse": mse_val,
            "rmse": rmse_val,
            "mae": mae_val,
            "mape": mape_val,
            "explained_variance": exp_var,
            "metrics": metrics_obj,
            "plots": plots_data,
            "model_b64": model_b64,
            "y_test": y_test.tolist(),
        }
        return res
    else:
        cm = confusion_matrix(y_test, predictions).tolist()
        acc_val = float(accuracy_score(y_test, predictions))
        prec_val = float(precision_score(y_test, predictions, average='weighted', zero_division=0))
        rec_val = float(recall_score(y_test, predictions, average='weighted', zero_division=0))
        f1_val = float(f1_score(y_test, predictions, average='weighted', zero_division=0))
        report = classification_report(y_test, predictions, output_dict=True, zero_division=0)

        plot_data = {"confusion_matrix": cm}
        if hasattr(model, 'feature_importances_'):
            plot_data["feature_importances"] = model.feature_importances_.tolist()
        elif hasattr(model, 'coef_'):
            coefs = model.coef_
            plot_data["feature_importances"] = np.abs(coefs[0] if len(coefs.shape) > 1 else coefs).tolist()

        if hasattr(model, 'predict_proba') and len(np.unique(y_test)) == 2:
            try:
                probs = model.predict_proba(X_test)[:, 1]
                fpr, tpr, _ = roc_curve(y_test, probs)
                plot_data["roc_curve"] = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
            except Exception:
                pass

        metrics_obj = {
            "task_type": "classification",
            "accuracy": acc_val,
            "precision": prec_val,
            "recall": rec_val,
            "f1": f1_val,
            "classification_report": report,
            "confusion_matrix": cm,
        }

        res = {
            "predictions": predictions.tolist(),
            "accuracy": acc_val,
            "precision": prec_val,
            "recall": rec_val,
            "f1": f1_val,
            "classification_report": report,
            "confusion_matrix": cm,
            "metrics": metrics_obj,
            "plots": plot_data,
            "model_b64": model_b64,
            "y_test": y_test.tolist(),
        }
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