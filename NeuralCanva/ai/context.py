"""
NeuralCanva AI Context Manager
Provides centralized, privacy-safe metadata about the user's datasets, pipelines, models,
metrics, and ML engine status without leaking raw rows or external data.
"""

import os
import json
import logging
import requests
from typing import Dict, Any, Optional
from django.conf import settings
from datasets.models import Dataset
from datasets.profiler import DatasetProfiler
from pipelines.models import Pipeline, Graph, TrainedModel
from common.storage import StorageAbstraction

logger = logging.getLogger(__name__)


class NeuralCanvaContextManager:
    """
    Constructs an isolated, compact context snapshot for the logged-in user.
    """

    @classmethod
    def get_user_context(cls, user, dataset_id: Optional[str] = None, pipeline_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Builds the complete project context object for the user.
        """
        # 1. Project base info
        project_info = {
            "name": "NeuralCanva",
            "version": "2.0",
            "description": "Visual ML/DL Pipeline Canvas & Experimentation Platform",
            "user": user.username if user else "anonymous",
        }

        # 2. Datasets info
        user_datasets = Dataset.objects.filter(owner=user).order_by('-uploaded_at')
        datasets_summary = []
        active_dataset_dict = None

        for ds in user_datasets[:10]:
            is_active = (str(ds.id) == str(dataset_id)) if dataset_id else (ds == user_datasets.first())
            ds_info = {
                "id": str(ds.id),
                "name": ds.name,
                "rows": ds.row_count or 0,
                "columns": len(ds.columns or []),
                "column_types": ds.column_types or {},
                "columns_list": ds.columns or [],
            }
            datasets_summary.append(ds_info)

            if is_active:
                # Build detailed stats for the active dataset
                active_dataset_dict = cls.get_dataset_detailed_context(ds)

        if not active_dataset_dict and user_datasets.exists():
            active_dataset_dict = cls.get_dataset_detailed_context(user_datasets.first())

        # 3. Pipelines info
        user_pipelines = Pipeline.objects.filter(owner=user).select_related('graph').order_by('-updated_at')
        pipelines_summary = []
        active_pipeline_dict = None

        for p in user_pipelines[:10]:
            g = getattr(p, 'graph', None)
            p_info = {
                "id": p.id,
                "name": p.name,
                "status": g.status if g else "idle",
                "nodes_count": len(g.nodes or []) if g else 0,
                "updated_at": str(p.updated_at),
            }
            pipelines_summary.append(p_info)

            if (pipeline_id and p.id == pipeline_id) or (not active_pipeline_dict and not pipeline_id and p == user_pipelines.first()):
                active_pipeline_dict = cls.get_pipeline_detailed_context(p, g)

        # 4. Available algorithms from FastAPI or local fallback registry
        available_algorithms = cls.get_available_algorithms()

        # 5. Trained models in Model Registry
        registered_models = []
        for m in TrainedModel.objects.filter(owner=user).order_by('-created_at')[:5]:
            registered_models.append({
                "id": m.id,
                "name": m.name,
                "algorithm": m.algorithm_name,
                "metrics": m.metrics or {},
                "created_at": str(m.created_at),
            })

        return {
            "project": project_info,
            "dataset": active_dataset_dict or {},
            "all_datasets": datasets_summary,
            "pipeline": active_pipeline_dict or {},
            "all_pipelines": pipelines_summary,
            "models_registry": registered_models,
            "available_algorithms": available_algorithms,
        }

    @classmethod
    def get_dataset_detailed_context(cls, dataset: Dataset) -> Dict[str, Any]:
        """Calculates dataset summary, column statistics, and task candidates safely."""
        try:
            profile = DatasetProfiler.profile_dataset(dataset)
        except Exception as e:
            logger.warning(f"Failed to calculate full profile for dataset {dataset.id}: {e}")
            profile = {
                "dataset_id": str(dataset.id),
                "dataset_name": dataset.name,
                "row_count": dataset.row_count or 0,
                "column_count": len(dataset.columns or []),
                "columns": dataset.columns or [],
                "column_types": dataset.column_types or {},
                "missing_summary": {},
            }

        # Calculate column classifications
        col_types = profile.get("column_types", {})
        num_cols = [c for c, t in col_types.items() if t == "numerical"]
        cat_cols = [c for c, t in col_types.items() if t == "categorical"]
        txt_cols = [c for c, t in col_types.items() if t == "text"]

        # Calculate suggested task
        suggested_targets = []
        suggested_task = "classification"
        try:
            df = StorageAbstraction.read_dataset_df(dataset)
            if df is not None and not df.empty:
                targets = DatasetProfiler.suggest_targets(df)
                suggested_targets = [t["column"] for t in targets] if targets else []
                if suggested_targets:
                    task_info = DatasetProfiler.detect_task(df, suggested_targets[0])
                    suggested_task = task_info.get("task", "classification")
        except Exception:
            pass

        return {
            "id": str(dataset.id),
            "name": dataset.name,
            "rows": profile.get("row_count", 0),
            "columns": profile.get("column_count", 0),
            "columns_info": profile.get("column_profiles", []),
            "column_types": col_types,
            "numeric_columns": num_cols,
            "categorical_columns": cat_cols,
            "text_columns": txt_cols,
            "missing_values": profile.get("missing_summary", {}),
            "duplicate_rows": profile.get("duplicate_rows", 0),
            "suggested_task": suggested_task,
            "suggested_targets": suggested_targets,
            "recommended_target": suggested_targets[0] if suggested_targets else None,
        }

    @classmethod
    def get_pipeline_detailed_context(cls, pipeline: Pipeline, graph: Optional[Graph] = None) -> Dict[str, Any]:
        """Extracts nodes, edges, execution error, and node outputs."""
        if not graph:
            graph = getattr(pipeline, 'graph', None)

        if not graph:
            return {
                "id": pipeline.id,
                "name": pipeline.name,
                "status": "idle",
                "nodes": [],
                "edges": [],
                "error": None,
                "metrics": {},
                "node_outputs": {},
            }

        nodes = graph.nodes or []
        edges = graph.edges or []
        node_outputs = graph.node_outputs or {}

        # Find any failed node or active model
        failed_node = None
        active_models = []
        for n in nodes:
            n_data = n.get("data", {}) if isinstance(n, dict) else {}
            n_type = n_data.get("nodeType", "")
            if n_data.get("status") == "failed":
                failed_node = {
                    "id": n.get("id"),
                    "type": n_type,
                    "title": n_data.get("title", n_type),
                    "params": n_data.get("params", {}),
                }
            if n_type in [
                "RandomForestClassifier", "GradientBoostingClassifier", "LogisticRegression",
                "SVC", "DecisionTreeClassifier", "LinearRegression", "Ridge", "Lasso",
                "RandomForestRegressor", "GradientBoostingRegressor", "DenseNN", "CNN"
            ]:
                active_models.append(n_type)

        # Extract aggregated metrics from node_outputs if available
        metrics = {}
        for nid, out in node_outputs.items():
            if isinstance(out, dict) and "metrics" in out:
                metrics[nid] = out["metrics"]
            elif isinstance(out, dict) and ("accuracy" in out or "r2" in out or "mse" in out):
                metrics[nid] = {k: out[k] for k in ["accuracy", "r2", "f1", "precision", "recall", "mse", "rmse"] if k in out}

        return {
            "id": pipeline.id,
            "name": pipeline.name,
            "status": graph.status,
            "error": graph.error,
            "failed_node": failed_node,
            "nodes_count": len(nodes),
            "nodes_summary": [
                {
                    "id": n.get("id"),
                    "type": n.get("data", {}).get("nodeType", ""),
                    "title": n.get("data", {}).get("title", ""),
                    "status": n.get("data", {}).get("status", "ready"),
                    "params": n.get("data", {}).get("params", {}),
                }
                for n in nodes if isinstance(n, dict)
            ],
            "edges": edges,
            "active_models": active_models,
            "metrics": metrics,
        }

    @classmethod
    def get_available_algorithms(cls) -> Dict[str, list]:
        """Fetches supported algorithms from FastAPI ML Engine or returns the local registry."""
        fastapi_url = getattr(settings, "FASTAPI_URL", "http://localhost:8001")
        try:
            resp = requests.get(f"{fastapi_url.rstrip('/')}/algorithms", timeout=2)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass

        # Fallback local registry
        return {
            "ml": [
                "LogisticRegression", "DecisionTreeClassifier", "RandomForestClassifier",
                "GradientBoostingClassifier", "ExtraTreesClassifier", "AdaBoostClassifier",
                "SVC", "KNeighborsClassifier", "LinearRegression", "Ridge", "Lasso",
                "ElasticNet", "DecisionTreeRegressor", "RandomForestRegressor",
                "GradientBoostingRegressor", "ExtraTreesRegressor", "SVR", "KNeighborsRegressor",
                "KMeans", "DBSCAN", "StandardScaler", "MinMaxScaler", "RobustScaler",
                "TfidfVectorizer", "CountVectorizer"
            ],
            "dl": ["DenseNN", "CNN", "RNN", "LSTM", "GRU", "Autoencoder"]
        }
