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
    AdaBoostClassifier, AdaBoostRegressor,
    BaggingClassifier, BaggingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
    VotingClassifier, VotingRegressor,
    StackingClassifier, StackingRegressor
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
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.feature_selection import SelectKBest, f_classif, f_regression, VarianceThreshold
from sklearn.model_selection import (
    train_test_split, GridSearchCV, RandomizedSearchCV, KFold, StratifiedKFold, cross_val_score
)
from sklearn.metrics import (
    accuracy_score, mean_squared_error, mean_absolute_error, r2_score,
    explained_variance_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix, roc_curve, precision_recall_curve, auc
)
from sklearn.inspection import permutation_importance
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
    "ExtraTreesClassifier": ExtraTreesClassifier,
    "SVC": SVC,
    "KNeighborsClassifier": KNeighborsClassifier,
    "GaussianNB": GaussianNB,
    "MultinomialNB": MultinomialNB,
    "Perceptron": Perceptron,
    "SGDClassifier": SGDClassifier,
    "PassiveAggressiveClassifier": PassiveAggressiveClassifier,
    "VotingClassifier": VotingClassifier,
    "StackingClassifier": StackingClassifier,

    # Classical ML - Regression
    "LinearRegression": LinearRegression,
    "Ridge": Ridge,
    "Lasso": Lasso,
    "ElasticNet": ElasticNet,
    "DecisionTreeRegressor": DecisionTreeRegressor,
    "RandomForestRegressor": RandomForestRegressor,
    "GradientBoostingRegressor": GradientBoostingRegressor,
    "AdaBoostRegressor": AdaBoostRegressor,
    "BaggingRegressor": BaggingRegressor,
    "ExtraTreesRegressor": ExtraTreesRegressor,
    "SVR": SVR,
    "KNeighborsRegressor": KNeighborsRegressor,
    "VotingRegressor": VotingRegressor,
    "StackingRegressor": StackingRegressor,

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
    "Imputer": SimpleImputer,
    "OutlierHandler": None,
    "FeatureSelector": None,
    "ClassImbalance": None,
}

if HAS_XGB:
    ALGORITHM_REGISTRY["XGBClassifier"] = XGBClassifier
    ALGORITHM_REGISTRY["XGBRegressor"] = XGBRegressor
if HAS_LGBM:
    ALGORITHM_REGISTRY["LGBMClassifier"] = LGBMClassifier
    ALGORITHM_REGISTRY["LGBMRegressor"] = LGBMRegressor


# ─── EXECUTOR ROUTER ──────────────────────────────────────────────────────────

def execute_algorithm(algorithm_type: str, params: dict, input_data: dict) -> dict:
    """
    Main entry point. Routes to the correct executor based on algorithm_type.
    """
    if algorithm_type in DL_ALGORITHMS:
        return execute_dl(algorithm_type, params, input_data)
    elif algorithm_type == "AutoML":
        return execute_automl(params, input_data)
    elif algorithm_type == "ModelComparison":
        return execute_model_comparison(params, input_data)
    elif algorithm_type == "CrossValidation":
        return execute_cross_validation(params, input_data)
    elif algorithm_type == "Explainability" or algorithm_type == "FeatureImportance":
        return execute_explainability(params, input_data)
    elif algorithm_type == "WhatIf":
        return execute_what_if(params, input_data)
    elif algorithm_type in ALGORITHM_REGISTRY or algorithm_type == "HyperparamTuning":
        return execute_ml(algorithm_type, params, input_data)
    else:
        raise ValueError(f"Unknown algorithm or task type: {algorithm_type}")


# ─── PREPROCESSING EXECUTORS ──────────────────────────────────────────────────

def run_imputer_node(params: dict, input_data: dict) -> dict:
    strategy = params.get('strategy', 'mean')  # mean, median, most_frequent, constant, drop
    fill_value = params.get('fill_value', 0)
    is_split = "X_train" in input_data and "X_test" in input_data

    if is_split:
        X_train = np.array(input_data['X_train'])
        X_test = np.array(input_data['X_test'])
        cols = input_data.get('columns', [])

        if strategy == 'drop':
            # drop rows with nan
            train_mask = ~pd.DataFrame(X_train).isnull().any(axis=1)
            test_mask = ~pd.DataFrame(X_test).isnull().any(axis=1)
            X_train_imp = X_train[train_mask]
            X_test_imp = X_test[test_mask]
            y_train = np.array(input_data['y_train'])[train_mask].tolist() if input_data.get('y_train') else []
            y_test = np.array(input_data['y_test'])[test_mask].tolist() if input_data.get('y_test') else []
        else:
            imputer = SimpleImputer(strategy=strategy if strategy != 'constant' else 'constant', fill_value=fill_value if strategy == 'constant' else None)
            X_train_imp = imputer.fit_transform(X_train)
            X_test_imp = imputer.transform(X_test)
            y_train = input_data.get('y_train')
            y_test = input_data.get('y_test')

        return {
            "X_train": X_train_imp.tolist() if hasattr(X_train_imp, 'tolist') else list(X_train_imp),
            "X_test": X_test_imp.tolist() if hasattr(X_test_imp, 'tolist') else list(X_test_imp),
            "y_train": y_train,
            "y_test": y_test,
            "columns": cols,
            "imputation_strategy": strategy
        }
    else:
        df = pd.DataFrame(input_data.get('dataframe', {}))
        if strategy == 'drop':
            df = df.dropna()
        elif strategy in ('mean', 'median'):
            for c in df.select_dtypes(include=[np.number]).columns:
                val = df[c].mean() if strategy == 'mean' else df[c].median()
                df[c] = df[c].fillna(val)
        elif strategy == 'most_frequent':
            for c in df.columns:
                mode_vals = df[c].mode()
                if not mode_vals.empty:
                    df[c] = df[c].fillna(mode_vals[0])
        elif strategy == 'constant':
            df = df.fillna(fill_value)

        return {
            "dataframe": df.to_dict(orient='list'),
            "columns": list(df.columns),
            "imputation_strategy": strategy
        }


def run_outlier_handler_node(params: dict, input_data: dict) -> dict:
    method = params.get('method', 'iqr_clip')  # iqr_clip, iqr_drop, zscore_clip
    threshold = float(params.get('threshold', 1.5))
    is_split = "X_train" in input_data and "X_test" in input_data

    def handle_arr(X_arr):
        df_num = pd.DataFrame(X_arr)
        for col in df_num.columns:
            s = pd.to_numeric(df_num[col], errors='coerce')
            if s.notnull().sum() > 4:
                q1 = s.quantile(0.25)
                q3 = s.quantile(0.75)
                iqr = q3 - q1
                lower = q1 - threshold * iqr
                upper = q3 + threshold * iqr
                df_num[col] = s.clip(lower=lower, upper=upper)
        return df_num.values

    if is_split:
        X_tr = handle_arr(input_data['X_train'])
        X_te = handle_arr(input_data['X_test'])
        return {
            "X_train": X_tr.tolist(),
            "X_test": X_te.tolist(),
            "y_train": input_data.get('y_train'),
            "y_test": input_data.get('y_test'),
            "columns": input_data.get('columns', []),
            "outlier_method": method
        }
    else:
        df = pd.DataFrame(input_data.get('dataframe', {}))
        for col in df.select_dtypes(include=[np.number]).columns:
            s = df[col]
            q1 = s.quantile(0.25)
            q3 = s.quantile(0.75)
            iqr = q3 - q1
            lower = q1 - threshold * iqr
            upper = q3 + threshold * iqr
            df[col] = s.clip(lower=lower, upper=upper)
        return {
            "dataframe": df.to_dict(orient='list'),
            "columns": list(df.columns),
            "outlier_method": method
        }


def run_feature_selector_node(params: dict, input_data: dict) -> dict:
    k = int(params.get('k', 5))
    method = params.get('method', 'SelectKBest')
    is_split = "X_train" in input_data and "X_test" in input_data

    if is_split:
        X_train = np.array(input_data['X_train'], dtype=float)
        X_test = np.array(input_data['X_test'], dtype=float)
        y_train = np.array(input_data['y_train'])
        cols = input_data.get('columns', [f"col_{i}" for i in range(X_train.shape[1])])

        actual_k = min(k, X_train.shape[1])
        is_regression = any(isinstance(v, float) and not v.is_integer() for v in y_train[:20] if v is not None)
        score_func = f_regression if is_regression else f_classif

        selector = SelectKBest(score_func=score_func, k=actual_k)
        X_tr_sel = selector.fit_transform(X_train, y_train)
        X_te_sel = selector.transform(X_test)

        mask = selector.get_support()
        selected_cols = [cols[i] for i, m in enumerate(mask) if m]

        return {
            "X_train": X_tr_sel.tolist(),
            "X_test": X_te_sel.tolist(),
            "y_train": input_data.get('y_train'),
            "y_test": input_data.get('y_test'),
            "columns": selected_cols,
            "selected_features": selected_cols,
            "feature_scores": dict(zip(cols, selector.scores_.tolist())) if hasattr(selector, 'scores_') else {}
        }
    else:
        return input_data


def run_class_imbalance_node(params: dict, input_data: dict) -> dict:
    method = params.get('method', 'RandomOverSampler')  # RandomOverSampler, RandomUnderSampler
    is_split = "X_train" in input_data and "X_test" in input_data

    if not is_split:
        return input_data

    X_train = np.array(input_data['X_train'], dtype=float)
    y_train = np.array(input_data['y_train'])

    classes, counts = np.unique(y_train, return_counts=True)
    if len(classes) < 2:
        return input_data

    max_count = max(counts)
    indices_by_class = {c: np.where(y_train == c)[0] for c in classes}

    new_indices = []
    if method == 'RandomUnderSampler':
        min_count = min(counts)
        for c in classes:
            chosen = np.random.choice(indices_by_class[c], size=min_count, replace=False)
            new_indices.extend(chosen)
    else:  # RandomOverSampler / default
        for c in classes:
            chosen = np.random.choice(indices_by_class[c], size=max_count, replace=True)
            new_indices.extend(chosen)

    np.random.shuffle(new_indices)
    return {
        "X_train": X_train[new_indices].tolist(),
        "X_test": input_data['X_test'],
        "y_train": y_train[new_indices].tolist(),
        "y_test": input_data['y_test'],
        "columns": input_data.get('columns', []),
        "imbalance_handled": True
    }


# ─── ML EXECUTOR ──────────────────────────────────────────────────────────────

def execute_ml(algorithm_type: str, params: dict, input_data: dict) -> dict:
    params = dict(params)
    include_plots = params.pop('include_plots', False)
    is_split = "X_train" in input_data and "X_test" in input_data

    # Dispatch custom preprocessing nodes
    if algorithm_type == "Imputer":
        return run_imputer_node(params, input_data)
    elif algorithm_type == "OutlierHandler":
        return run_outlier_handler_node(params, input_data)
    elif algorithm_type == "FeatureSelector":
        return run_feature_selector_node(params, input_data)
    elif algorithm_type == "ClassImbalance":
        return run_class_imbalance_node(params, input_data)

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

            return {
                "dataframe": df.to_dict(orient='list'),
                "columns": list(df.columns),
                "vectorizer_params": {
                    "method": "TF-IDF" if algorithm_type == "TfidfVectorizer" else "Count",
                    "features": [col_name],
                    "vocabulary": vec.vocabulary_,
                    "idf": dict(zip(vec.get_feature_names_out(), vec.idf_.tolist())) if hasattr(vec, 'idf_') else {},
                }
            }
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

            return {
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

    # ── Embeddings Node ──
    if algorithm_type == "Embeddings":
        method = params.get('method', 'Word2Vec')
        features = params.get('features', [])
        all_columns = input_data.get('columns', [])
        col_name = features[0] if features else (all_columns[0] if all_columns else 'text')

        def compute_simple_embeddings(texts):
            vecs = []
            for t in texts:
                words = str(t).lower().split()
                if not words:
                    vecs.append([0.0] * 20)
                else:
                    v = np.zeros(20)
                    for w in words:
                        np.random.seed(abs(hash(w)) % (2**31))
                        v += np.random.randn(20)
                    vecs.append((v / max(len(words), 1)).tolist())
            return vecs

        if is_split and all_columns:
            col_idx = all_columns.index(col_name) if col_name in all_columns else 0
            train_emb = compute_simple_embeddings([r[col_idx] for r in input_data["X_train"]])
            test_emb = compute_simple_embeddings([r[col_idx] for r in input_data["X_test"]])
            emb_cols = [f"{col_name}_emb_{i}" for i in range(20)]

            new_tr = [([v for i, v in enumerate(r) if i != col_idx] + train_emb[idx]) for idx, r in enumerate(input_data["X_train"])]
            new_te = [([v for i, v in enumerate(r) if i != col_idx] + test_emb[idx]) for idx, r in enumerate(input_data["X_test"])]
            new_cols = [c for i, c in enumerate(all_columns) if i != col_idx] + emb_cols

            return {
                "X_train": new_tr,
                "X_test": new_te,
                "y_train": input_data.get("y_train"),
                "y_test": input_data.get("y_test"),
                "columns": new_cols,
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
                param_grid = {"n_estimators": [10, 50, 100], "max_depth": [3, 5, None]}
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
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        if search_method == 'RandomSearch':
            search = RandomizedSearchCV(base_clf, param_distributions=param_grid, cv=cv_folds, n_iter=5, random_state=42)
        else:
            search = GridSearchCV(base_clf, param_grid=param_grid, cv=cv_folds)

        search.fit(X_train, y_train)
        best_model = search.best_estimator_
        predictions = best_model.predict(X_test)
        model_b64 = base64.b64encode(pickle.dumps(best_model)).decode('utf-8')

        is_classifier = sub_algo.endswith("Classifier") or sub_algo in ["SVC", "LogisticRegression", "GaussianNB", "MultinomialNB", "Perceptron", "SGDClassifier"]
        if is_classifier:
            acc = float(accuracy_score(y_test, predictions))
            prec = float(precision_score(y_test, predictions, average='weighted', zero_division=0))
            rec = float(recall_score(y_test, predictions, average='weighted', zero_division=0))
            f1_val = float(f1_score(y_test, predictions, average='weighted', zero_division=0))
            cm = confusion_matrix(y_test, predictions).tolist()
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

    # Extract non-constructor params
    selected_columns = params.pop('columns', None)
    apply_all = params.pop('apply_all', False)
    test_size = params.pop('test_size', 0.2)
    stratify_flag = params.pop('stratify', False)

    # Specific model constructor adjustments
    if algorithm_type == "LogisticRegression":
        penalty = params.get('penalty')
        solver = params.get('solver')
        if penalty == 'l1':
            if not solver or solver not in ('liblinear', 'saga'):
                params['solver'] = 'liblinear'
            params.pop('l1_ratio', None)
        elif penalty == 'elasticnet':
            if not solver or solver != 'saga':
                params['solver'] = 'saga'
            if 'l1_ratio' not in params:
                params['l1_ratio'] = 0.5
        elif penalty == 'none' or penalty is None:
            params['penalty'] = None

    elif algorithm_type in ["VotingClassifier", "StackingClassifier"]:
        if "estimators" not in params:
            params["estimators"] = [
                ("lr", LogisticRegression(max_iter=500)),
                ("rf", RandomForestClassifier(n_estimators=50, random_state=42)),
                ("gb", GradientBoostingClassifier(n_estimators=50, random_state=42))
            ]

    elif algorithm_type in ["VotingRegressor", "StackingRegressor"]:
        if "estimators" not in params:
            params["estimators"] = [
                ("lr", LinearRegression()),
                ("rf", RandomForestRegressor(n_estimators=50, random_state=42)),
                ("gb", GradientBoostingRegressor(n_estimators=50, random_state=42))
            ]

    clf_class = ALGORITHM_REGISTRY[algorithm_type]
    try:
        model = clf_class(**params)
    except TypeError as te:
        raise ValueError(f"{algorithm_type} parameter error: {str(te)}") from te
    except Exception as exc:
        raise ValueError(f"{algorithm_type} initialization error: {str(exc)}") from exc

    # Scalers
    if algorithm_type in ["StandardScaler", "MinMaxScaler", "RobustScaler", "MaxAbsScaler", "Normalizer"]:
        all_columns = input_data.get('columns', [])
        if is_split:
            X_train_arr = np.array(input_data['X_train'], dtype=float)
            X_test_arr = np.array(input_data['X_test'], dtype=float)
            col_indices = [all_columns.index(c) for c in selected_columns if c in all_columns] if (not apply_all and selected_columns and all_columns) else list(range(X_train_arr.shape[1]))

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
            X_arr = np.array(input_data.get('X', []), dtype=float)
            col_indices = list(range(X_arr.shape[1]))
            model.fit(X_arr[:, col_indices])
            X_arr[:, col_indices] = model.transform(X_arr[:, col_indices])
            result = {
                "X": X_arr.tolist(),
                "y": input_data.get('y'),
                "columns": all_columns,
            }

        scaler_dict = {"columns": selected_columns or all_columns if not apply_all else all_columns}
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

    # Clustering
    if algorithm_type in ["KMeans", "DBSCAN", "AgglomerativeClustering"]:
        X = np.array(input_data.get('X', input_data.get('X_train', [])), dtype=float)
        labels = model.fit_predict(X)
        return {"labels": labels.tolist(), "cluster_counts": dict(pd.Series(labels).value_counts())}

    # PCA
    if algorithm_type == "PCA":
        if is_split:
            X_train = np.array(input_data['X_train'], dtype=float)
            X_test = np.array(input_data['X_test'], dtype=float)
            model.fit(X_train)
            return {
                "X_train": model.transform(X_train).tolist(),
                "X_test": model.transform(X_test).tolist(),
                "y_train": input_data.get('y_train'),
                "y_test": input_data.get('y_test'),
                "explained_variance_ratio": model.explained_variance_ratio_.tolist(),
            }
        else:
            X = np.array(input_data['X'], dtype=float)
            return {
                "transformed": model.fit_transform(X).tolist(),
                "explained_variance_ratio": model.explained_variance_ratio_.tolist(),
            }


    # Supervised Model Training
    if is_split:
        # ── Guard: reject text/string columns before they crash numpy ────────
        X_train_raw = input_data['X_train']
        X_test_raw = input_data['X_test']
        columns = input_data.get('columns', [])
        if X_train_raw and columns:
            _sample_df = pd.DataFrame(X_train_raw[:5], columns=columns) if len(columns) == len(X_train_raw[0]) else None
            if _sample_df is not None:
                bad_cols = [c for c in _sample_df.columns if _sample_df[c].dtype == object or pd.api.types.is_string_dtype(_sample_df[c])]
                if bad_cols:
                    from fastapi import HTTPException
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "error": "UNENCODED_FEATURES",
                            "message": f"Feature columns still contain text values: {', '.join(bad_cols)}. Encode them before training.",
                            "columns": bad_cols,
                            "suggestion": "Connect a Categorical Encoder node before the model node.",
                        }
                    )

        X_train = np.array(X_train_raw, dtype=float)
        X_test = np.array(X_test_raw, dtype=float)
        y_train = np.array(input_data['y_train'])
        y_test = np.array(input_data['y_test'])

    else:
        X_float = np.array(input_data['X'], dtype=float)
        y = np.array(input_data['y'])
        X_train, X_test, y_train, y_test = train_test_split(X_float, y, test_size=test_size, random_state=42)

    model.fit(X_train, y_train)
    model_b64 = base64.b64encode(pickle.dumps(model)).decode('utf-8')
    predictions = model.predict(X_test)

    is_regression = algorithm_type in [
        "LinearRegression", "Ridge", "Lasso", "ElasticNet",
        "DecisionTreeRegressor", "RandomForestRegressor",
        "GradientBoostingRegressor", "AdaBoostRegressor", "BaggingRegressor",
        "ExtraTreesRegressor", "SVR", "KNeighborsRegressor", "VotingRegressor", "StackingRegressor",
        "XGBRegressor", "LGBMRegressor"
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

        return {
            "predictions": predictions.tolist(),
            "r2": r2_val,
            "mse": mse_val,
            "rmse": rmse_val,
            "mae": mae_val,
            "explained_variance": exp_var,
            "metrics": {
                "task_type": "regression",
                "r2": r2_val,
                "mse": mse_val,
                "rmse": rmse_val,
                "mae": mae_val,
                "explained_variance": exp_var,
            },
            "plots": plots_data,
            "model_b64": model_b64,
            "y_test": y_test.tolist(),
        }
    else:
        acc_val = float(accuracy_score(y_test, predictions))
        prec_val = float(precision_score(y_test, predictions, average='weighted', zero_division=0))
        rec_val = float(recall_score(y_test, predictions, average='weighted', zero_division=0))
        f1_val = float(f1_score(y_test, predictions, average='weighted', zero_division=0))
        cm = confusion_matrix(y_test, predictions).tolist()
        report = classification_report(y_test, predictions, output_dict=True, zero_division=0)

        plot_data = {"confusion_matrix": cm}
        if hasattr(model, 'feature_importances_'):
            plot_data["feature_importances"] = model.feature_importances_.tolist()
        elif hasattr(model, 'coef_'):
            coefs = model.coef_
            plot_data["feature_importances"] = np.abs(coefs[0] if len(coefs.shape) > 1 else coefs).tolist()

        # ROC Curve & Precision-Recall Curve for binary classification
        if hasattr(model, 'predict_proba') and len(np.unique(y_test)) == 2:
            try:
                probs = model.predict_proba(X_test)[:, 1]
                fpr, tpr, _ = roc_curve(y_test, probs)
                roc_auc = float(auc(fpr, tpr))
                precisions, recalls, _ = precision_recall_curve(y_test, probs)
                plot_data["roc_curve"] = {"fpr": fpr.tolist(), "tpr": tpr.tolist(), "auc": roc_auc}
                plot_data["pr_curve"] = {"precision": precisions.tolist(), "recall": recalls.tolist()}
            except Exception:
                pass

        return {
            "predictions": predictions.tolist(),
            "accuracy": acc_val,
            "precision": prec_val,
            "recall": rec_val,
            "f1": f1_val,
            "classification_report": report,
            "confusion_matrix": cm,
            "metrics": {
                "task_type": "classification",
                "accuracy": acc_val,
                "precision": prec_val,
                "recall": rec_val,
                "f1": f1_val,
                "classification_report": report,
                "confusion_matrix": cm,
            },
            "plots": plot_data,
            "model_b64": model_b64,
            "y_test": y_test.tolist(),
        }


# ─── AUTOML ENGINE ────────────────────────────────────────────────────────────

def execute_automl(params: dict, input_data: dict) -> dict:
    """
    AutoML Engine:
    1. Reads input data (split or raw)
    2. Determines classification vs regression
    3. Evaluates compatible candidate algorithms
    4. Ranks candidates and stores winning model
    """
    is_split = "X_train" in input_data and "X_test" in input_data
    if is_split:
        X_train = np.array(input_data['X_train'], dtype=float)
        X_test = np.array(input_data['X_test'], dtype=float)
        y_train = np.array(input_data['y_train'])
        y_test = np.array(input_data['y_test'])
    else:
        X = np.array(input_data['X'], dtype=float)
        y = np.array(input_data['y'])
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Determine task
    is_regression = any(isinstance(v, float) and not v.is_integer() for v in y_train[:20] if v is not None)
    task_type = "regression" if is_regression else "classification"

    if is_regression:
        candidate_algos = [
            ("RandomForestRegressor", RandomForestRegressor(n_estimators=50, random_state=42)),
            ("GradientBoostingRegressor", GradientBoostingRegressor(n_estimators=50, random_state=42)),
            ("LinearRegression", LinearRegression()),
            ("Ridge", Ridge()),
            ("DecisionTreeRegressor", DecisionTreeRegressor(max_depth=5, random_state=42)),
            ("ExtraTreesRegressor", ExtraTreesRegressor(n_estimators=50, random_state=42)),
        ]
    else:
        candidate_algos = [
            ("RandomForestClassifier", RandomForestClassifier(n_estimators=50, random_state=42)),
            ("GradientBoostingClassifier", GradientBoostingClassifier(n_estimators=50, random_state=42)),
            ("LogisticRegression", LogisticRegression(max_iter=500)),
            ("DecisionTreeClassifier", DecisionTreeClassifier(max_depth=5, random_state=42)),
            ("ExtraTreesClassifier", ExtraTreesClassifier(n_estimators=50, random_state=42)),
            ("GaussianNB", GaussianNB()),
        ]

    leaderboard = []
    best_model_obj = None
    best_score = -float('inf')
    best_algo_name = None

    for name, model in candidate_algos:
        try:
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            if is_regression:
                r2 = float(r2_score(y_test, preds))
                mse = float(mean_squared_error(y_test, preds))
                rmse = float(np.sqrt(mse))
                mae = float(mean_absolute_error(y_test, preds))
                score = r2
                leaderboard.append({
                    "algorithm": name,
                    "r2": round(r2, 4),
                    "mse": round(mse, 4),
                    "rmse": round(rmse, 4),
                    "mae": round(mae, 4),
                    "status": "success"
                })
            else:
                acc = float(accuracy_score(y_test, preds))
                prec = float(precision_score(y_test, preds, average='weighted', zero_division=0))
                rec = float(recall_score(y_test, preds, average='weighted', zero_division=0))
                f1_val = float(f1_score(y_test, preds, average='weighted', zero_division=0))
                score = f1_val
                leaderboard.append({
                    "algorithm": name,
                    "accuracy": round(acc, 4),
                    "precision": round(prec, 4),
                    "recall": round(rec, 4),
                    "f1": round(f1_val, 4),
                    "status": "success"
                })

            if score > best_score:
                best_score = score
                best_model_obj = model
                best_algo_name = name
        except Exception as e:
            leaderboard.append({
                "algorithm": name,
                "status": "failed",
                "error": str(e)[:100]
            })

    # Sort leaderboard
    if is_regression:
        leaderboard.sort(key=lambda x: x.get("r2", -999), reverse=True)
    else:
        leaderboard.sort(key=lambda x: x.get("f1", -999), reverse=True)

    winning_b64 = base64.b64encode(pickle.dumps(best_model_obj)).decode('utf-8') if best_model_obj else ""
    winning_preds = best_model_obj.predict(X_test).tolist() if best_model_obj else []

    return {
        "task_type": task_type,
        "best_algorithm": best_algo_name,
        "best_score": round(best_score, 4),
        "leaderboard": leaderboard,
        "model_b64": winning_b64,
        "predictions": winning_preds,
        "y_test": y_test.tolist(),
        "metrics": leaderboard[0] if leaderboard else {}
    }


# ─── MODEL COMPARISON EXECUTOR ────────────────────────────────────────────────

def execute_model_comparison(params: dict, input_data: dict) -> dict:
    """Evaluates a user-selected list of compatible algorithms on the same dataset split."""
    selected_algos = params.get('algorithms', [])
    if not selected_algos:
        selected_algos = ["LogisticRegression", "RandomForestClassifier", "DecisionTreeClassifier"]

    is_split = "X_train" in input_data and "X_test" in input_data
    if is_split:
        X_train = np.array(input_data['X_train'], dtype=float)
        X_test = np.array(input_data['X_test'], dtype=float)
        y_train = np.array(input_data['y_train'])
        y_test = np.array(input_data['y_test'])
    else:
        X = np.array(input_data['X'], dtype=float)
        y = np.array(input_data['y'])
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    is_regression = any(isinstance(v, float) and not v.is_integer() for v in y_train[:20] if v is not None)
    results = []

    for name in selected_algos:
        if name not in ALGORITHM_REGISTRY:
            continue
        try:
            cls = ALGORITHM_REGISTRY[name]
            model = cls()
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            if is_regression:
                r2 = float(r2_score(y_test, preds))
                mse = float(mean_squared_error(y_test, preds))
                rmse = float(np.sqrt(mse))
                mae = float(mean_absolute_error(y_test, preds))
                results.append({
                    "algorithm": name,
                    "r2": round(r2, 4),
                    "mse": round(mse, 4),
                    "rmse": round(rmse, 4),
                    "mae": round(mae, 4),
                    "status": "success"
                })
            else:
                acc = float(accuracy_score(y_test, preds))
                prec = float(precision_score(y_test, preds, average='weighted', zero_division=0))
                rec = float(recall_score(y_test, preds, average='weighted', zero_division=0))
                f1_val = float(f1_score(y_test, preds, average='weighted', zero_division=0))
                results.append({
                    "algorithm": name,
                    "accuracy": round(acc, 4),
                    "precision": round(prec, 4),
                    "recall": round(rec, 4),
                    "f1": round(f1_val, 4),
                    "status": "success"
                })
        except Exception as e:
            results.append({"algorithm": name, "status": "failed", "error": str(e)[:100]})

    if is_regression:
        results.sort(key=lambda x: x.get("r2", -999), reverse=True)
    else:
        results.sort(key=lambda x: x.get("f1", -999), reverse=True)

    return {
        "task_type": "regression" if is_regression else "classification",
        "comparison_table": results,
        "leaderboard": results,
        "best_algorithm": results[0]["algorithm"] if results else None
    }


# ─── CROSS VALIDATION EXECUTOR ────────────────────────────────────────────────

def execute_cross_validation(params: dict, input_data: dict) -> dict:
    algo_name = params.get('algorithm', 'RandomForestClassifier')
    cv_folds = int(params.get('cv_folds', 5))
    scoring = params.get('scoring', 'accuracy')

    X = np.array(input_data.get('X', input_data.get('X_train', [])), dtype=float)
    y = np.array(input_data.get('y', input_data.get('y_train', [])))

    clf_cls = ALGORITHM_REGISTRY.get(algo_name, RandomForestClassifier)
    model = clf_cls()

    is_stratified = params.get('stratified', True) and not any(isinstance(v, float) and not v.is_integer() for v in y[:20] if v is not None)
    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42) if is_stratified else KFold(n_splits=cv_folds, shuffle=True, random_state=42)

    scores = cross_val_score(model, X, y, cv=cv, scoring=scoring if scoring != 'default' else None)

    fold_details = [{"fold": i + 1, "score": round(float(s), 4)} for i, s in enumerate(scores)]
    return {
        "algorithm": algo_name,
        "cv_folds": cv_folds,
        "scoring_metric": scoring,
        "folds": fold_details,
        "mean_score": round(float(np.mean(scores)), 4),
        "std_dev": round(float(np.std(scores)), 4)
    }


# ─── EXPLAINABILITY & WHAT-IF ─────────────────────────────────────────────────

def execute_explainability(params: dict, input_data: dict) -> dict:
    cols = input_data.get('columns', [])
    X_test = np.array(input_data.get('X_test', []), dtype=float)
    y_test = np.array(input_data.get('y_test', []))
    model_b64 = params.get('model_b64') or input_data.get('model_b64')

    if not model_b64 or len(X_test) == 0:
        return {"feature_importance": []}

    model = pickle.loads(base64.b64decode(model_b64))

    importance_list = []
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        for idx, imp in enumerate(importances):
            col_name = cols[idx] if idx < len(cols) else f"feature_{idx}"
            importance_list.append({"feature": col_name, "importance": round(float(imp), 4)})
    elif hasattr(model, 'coef_'):
        coefs = np.abs(model.coef_[0] if len(model.coef_.shape) > 1 else model.coef_)
        for idx, imp in enumerate(coefs):
            col_name = cols[idx] if idx < len(cols) else f"feature_{idx}"
            importance_list.append({"feature": col_name, "importance": round(float(imp), 4)})
    else:
        # Fallback to permutation importance
        try:
            r = permutation_importance(model, X_test, y_test, n_repeats=3, random_state=42)
            for idx, imp in enumerate(r.importances_mean):
                col_name = cols[idx] if idx < len(cols) else f"feature_{idx}"
                importance_list.append({"feature": col_name, "importance": round(float(imp), 4)})
        except Exception:
            pass

    importance_list.sort(key=lambda x: x["importance"], reverse=True)
    return {
        "feature_importance": importance_list,
        "top_positive": importance_list[:5],
        "top_negative": sorted(importance_list, key=lambda x: x["importance"])[:5]
    }


def execute_what_if(params: dict, input_data: dict) -> dict:
    feature_values = params.get('feature_values', {})
    cols = input_data.get('columns', list(feature_values.keys()))
    model_b64 = params.get('model_b64') or input_data.get('model_b64')

    if not model_b64:
        raise ValueError("Model binary is required for What-If simulation.")

    model = pickle.loads(base64.b64decode(model_b64))
    vector = [float(feature_values.get(c, 0.0)) for c in cols]

    pred = model.predict([vector])[0]
    confidence = None
    if hasattr(model, 'predict_proba'):
        try:
            probs = model.predict_proba([vector])[0]
            confidence = round(float(max(probs)), 4)
        except Exception:
            pass

    return {
        "prediction": pred.item() if hasattr(pred, 'item') else pred,
        "confidence": confidence,
        "input_features": feature_values
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

    acc_history = history.history.get('accuracy', [])
    val_acc_history = history.history.get('val_accuracy', [])
    loss_history = history.history.get('loss', [])

    return {
        "final_accuracy": acc_history[-1] if acc_history else 0.0,
        "final_val_accuracy": val_acc_history[-1] if val_acc_history else 0.0,
        "final_loss": loss_history[-1] if loss_history else 0.0,
        "epochs_run": len(acc_history),
        "learning_curves": {
            "accuracy": [round(float(v), 4) for v in acc_history],
            "val_accuracy": [round(float(v), 4) for v in val_acc_history],
            "loss": [round(float(v), 4) for v in loss_history]
        },
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
        model.add(layers.Dense(units // 4, activation='relu'))
        model.add(layers.Dense(units, activation='relu'))
        model.add(layers.Dense(input_shape[0], activation='sigmoid'))

    return model