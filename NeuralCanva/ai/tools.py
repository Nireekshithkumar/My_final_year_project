"""
NeuralCanva AI Tools
Predefined, safe tools that call existing Django and FastAPI services without arbitrary code execution.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool
from datasets.models import Dataset
from datasets.profiler import DatasetProfiler
from pipelines.models import Pipeline, Graph
from common.storage import StorageAbstraction
from .context import NeuralCanvaContextManager

logger = logging.getLogger(__name__)


# Helper dictionary for algorithm explanations
ALGORITHM_KNOWLEDGE = {
    "RandomForestClassifier": {
        "title": "Random Forest Classifier",
        "category": "Classification / Ensemble",
        "description": "An ensemble method constructing multiple decision trees during training and outputting the mode of their classes.",
        "how_it_works": "Bootstraps data subsets with random feature subsets, reducing overfitting compared to single decision trees.",
        "when_to_use": [
            "Tabular datasets with complex non-linear feature interactions.",
            "When high accuracy is desired without heavy hyperparameter tuning.",
            "When feature importance ranking is needed."
        ],
        "hyperparameters_guide": {
            "n_estimators": "Number of trees in forest (default: 100). Higher = better generalizability but slower.",
            "max_depth": "Max depth of trees. None = expand until all leaves are pure.",
            "min_samples_split": "Min samples required to split an internal node.",
        },
        "best_practices": [
            "Standard scaling is optional (trees are scale-invariant).",
            "Encode categorical columns before training."
        ]
    },
    "GradientBoostingClassifier": {
        "title": "Gradient Boosting Classifier",
        "category": "Classification / Boosting",
        "description": "Sequential ensemble technique building trees sequentially, where each new tree corrects the residual errors of prior trees.",
        "how_it_works": "Optimizes an arbitrary differentiable loss function via gradient descent in function space.",
        "when_to_use": [
            "When seeking state-of-the-art accuracy on structured tabular data.",
            "Competitive ML benchmarks and fraud/churn prediction tasks."
        ],
        "hyperparameters_guide": {
            "n_estimators": "Number of boosting stages to perform (default: 100).",
            "learning_rate": "Shrinks the contribution of each tree (default: 0.1).",
            "max_depth": "Max depth of individual regression estimators (default: 3).",
        },
        "best_practices": [
            "Use lower learning rates (< 0.05) with more estimators to avoid overfitting."
        ]
    },
    "LogisticRegression": {
        "title": "Logistic Regression",
        "category": "Classification / Linear",
        "description": "A linear model using the logistic sigmoid function to model the probability of a discrete outcome.",
        "how_it_works": "Calculates a weighted sum of input features and passes it through the sigmoid function: 1 / (1 + e^-z).",
        "when_to_use": [
            "Linearly separable classification tasks.",
            "When fast training and high model interpretability (odds ratios) are required."
        ],
        "hyperparameters_guide": {
            "C": "Inverse of regularization strength. Smaller values = stronger regularization.",
            "penalty": "Norm used in penalization ('l1', 'l2', 'elasticnet').",
            "solver": "Algorithm for optimization ('lbfgs', 'liblinear', 'saga'). Note: 'liblinear' supports 'l1' penalty.",
        },
        "best_practices": [
            "ALWAYS apply StandardScaler or MinMaxScaler before LogisticRegression.",
            "For L1 penalty, use solver='liblinear' or 'saga'."
        ]
    },
    "LinearRegression": {
        "title": "Ordinary Least Squares Linear Regression",
        "category": "Regression / Linear",
        "description": "Fits a linear model with coefficients w = (w1, ..., wp) to minimize the residual sum of squares.",
        "how_it_works": "Finds the hyperplane minimizing Euclidean distance between predicted and actual continuous targets.",
        "when_to_use": [
            "Predicting continuous values with linear feature relationships (e.g. price, temperature).",
            "Clear baseline model for all regression problems."
        ],
        "hyperparameters_guide": {
            "fit_intercept": "Whether to calculate the intercept for this model (default: True).",
        },
        "best_practices": [
            "Check for multicollinearity among independent variables.",
            "Normalize or scale features."
        ]
    },
    "RandomForestRegressor": {
        "title": "Random Forest Regressor",
        "category": "Regression / Ensemble",
        "description": "A meta estimator that fits multiple classifying decision trees on sub-samples and averages predictions.",
        "how_it_works": "Averages continuous predictions from diverse decision trees to minimize mean squared error.",
        "when_to_use": [
            "Tabular regression problems with non-linear relationships and interactions."
        ],
        "hyperparameters_guide": {
            "n_estimators": "Number of trees (default: 100).",
            "max_depth": "Maximum tree depth.",
        },
        "best_practices": [
            "Handles outliers better than linear regression models."
        ]
    },
    "StandardScaler": {
        "title": "Standard Scaler",
        "category": "Data Preprocessing",
        "description": "Standardizes features by removing the mean and scaling to unit variance (z = (x - u) / s).",
        "how_it_works": "Centers features around 0 with standard deviation of 1.",
        "when_to_use": [
            "Before Linear Regression, Logistic Regression, SVM, KNN, Neural Networks.",
            "Any distance-based or gradient-descent optimization algorithm."
        ],
        "hyperparameters_guide": {
            "with_mean": "If True, center data before scaling.",
            "with_std": "If True, scale data to unit variance.",
        },
        "best_practices": [
            "Do NOT fit scaler on test split (always fit on train, transform on test)."
        ]
    },
    "splitDataset": {
        "title": "Train / Test Split",
        "category": "Data Management",
        "description": "Splits arrays or matrices into random train and test subsets.",
        "how_it_works": "Partitions dataset into training set (for fitting) and test set (for unseen evaluation).",
        "when_to_use": [
            "MANDATORY before training any supervised ML/DL model."
        ],
        "hyperparameters_guide": {
            "test_size": "Proportion of dataset to include in test split (e.g. 0.2 for 80/20 split).",
            "target_column": "The column name to predict (y).",
            "random_state": "Controls shuffling applied to data before split.",
        },
        "best_practices": [
            "Standard test_size is 0.2 (20%) or 0.25 (25%)."
        ]
    }
}


def create_ai_tools_for_user(user, dataset_id: Optional[str] = None, pipeline_id: Optional[int] = None):
    """
    Factory creating bound tools with user permission checks.
    """

    @tool
    def analyze_dataset_tool(target_dataset_id: Optional[str] = None) -> str:
        """
        Analyzes the specified dataset (or active dataset) and returns statistical summary,
        column classifications, missing value counts, and suggested ML tasks.
        """
        ds_id = target_dataset_id or dataset_id
        if not ds_id:
            first_ds = Dataset.objects.filter(owner=user).first()
            if not first_ds:
                return "No datasets found in your account. Please upload a CSV dataset first."
            ds_id = str(first_ds.id)

        try:
            ds = Dataset.objects.get(id=ds_id, owner=user)
        except Dataset.DoesNotExist:
            return f"Dataset with ID '{ds_id}' not found or access denied."

        context = NeuralCanvaContextManager.get_dataset_detailed_context(ds)
        missing_count = sum(context.get("missing_values", {}).values()) if isinstance(context.get("missing_values"), dict) else 0
        total_cells = (context.get("rows", 0) * context.get("columns", 1)) or 1
        missing_pct = round((missing_count / total_cells) * 100, 2)

        return json.dumps({
            "dataset_id": str(ds.id),
            "name": ds.name,
            "rows": context.get("rows", 0),
            "columns": context.get("columns", 0),
            "numerical_columns": context.get("numeric_columns", []),
            "categorical_columns": context.get("categorical_columns", []),
            "text_columns": context.get("text_columns", []),
            "missing_cells": missing_count,
            "missing_percentage": f"{missing_pct}%",
            "duplicate_rows": context.get("duplicate_rows", 0),
            "suggested_task": context.get("suggested_task", "classification"),
            "suggested_targets": context.get("suggested_targets", []),
            "recommended_target": context.get("recommended_target"),
        }, indent=2)

    @tool
    def recommend_model_tool(task_type: str = "classification", dataset_name: Optional[str] = None) -> str:
        """
        Recommends the best machine learning or deep learning algorithms for the given task and data profile,
        with detailed rationale for why they are selected.
        """
        task = task_type.lower()
        if "regress" in task or "price" in task or "value" in task or "continuous" in task:
            recommendations = [
                {
                    "name": "RandomForestRegressor",
                    "category": "ML / Ensemble",
                    "confidence": 0.95,
                    "reasons": [
                        "Handles non-linear relationships and interactions without scaling.",
                        "Robust against tabular outliers.",
                        "Provides feature importance rankings."
                    ]
                },
                {
                    "name": "GradientBoostingRegressor",
                    "category": "ML / Boosting",
                    "confidence": 0.92,
                    "reasons": [
                        "Higher accuracy through sequential error correction.",
                        "Standard competitive benchmark for regression."
                    ]
                },
                {
                    "name": "Ridge",
                    "category": "ML / Linear",
                    "confidence": 0.85,
                    "reasons": [
                        "Fast training with L2 regularization to prevent overfitting.",
                        "Highly interpretable coefficients."
                    ]
                }
            ]
        elif "cluster" in task:
            recommendations = [
                {
                    "name": "KMeans",
                    "category": "ML / Unsupervised",
                    "confidence": 0.90,
                    "reasons": [
                        "Fast and scalable partition-based clustering.",
                        "Works well for spherical cluster geometries."
                    ]
                },
                {
                    "name": "DBSCAN",
                    "category": "ML / Density-based",
                    "confidence": 0.86,
                    "reasons": [
                        "Discovers arbitrary shape clusters without pre-specifying K.",
                        "Automatically isolates outliers and noise."
                    ]
                }
            ]
        else:
            # Classification default
            recommendations = [
                {
                    "name": "RandomForestClassifier",
                    "category": "ML / Ensemble",
                    "confidence": 0.95,
                    "reasons": [
                        "Excels on tabular data with mixed numerical and categorical features.",
                        "Scale-invariant and naturally resists overfitting.",
                        "Provides direct feature importance."
                    ]
                },
                {
                    "name": "GradientBoostingClassifier",
                    "category": "ML / Boosting",
                    "confidence": 0.93,
                    "reasons": [
                        "Iterative gradient descent minimizes classification loss.",
                        "Often achieves highest AUC and F1 scores on benchmark datasets."
                    ]
                },
                {
                    "name": "LogisticRegression",
                    "category": "ML / Linear",
                    "confidence": 0.88,
                    "reasons": [
                        "Fast baseline with probabilistic output and clear feature odds ratios.",
                        "Requires StandardScaler preprocessing."
                    ]
                }
            ]

        return json.dumps({
            "task_type": task,
            "top_recommended": recommendations[0]["name"],
            "recommendations": recommendations,
            "evaluation_metric": "R2 Score" if "regress" in task else "Accuracy / F1-Score",
        }, indent=2)

    @tool
    def explain_pipeline_error_tool(target_pipeline_id: Optional[int] = None) -> str:
        """
        Inspects the execution status, node tracebacks, parameter mismatches, and logs
        for the given pipeline, and returns root cause diagnosis and fix instructions.
        """
        pid = target_pipeline_id or pipeline_id
        if not pid:
            p = Pipeline.objects.filter(owner=user).order_by('-updated_at').first()
            if not p:
                return "No pipeline found to inspect."
            pid = p.id

        try:
            pipeline = Pipeline.objects.get(id=pid, owner=user)
            graph = getattr(pipeline, 'graph', None)
        except Pipeline.DoesNotExist:
            return f"Pipeline #{pid} not found."

        if not graph:
            return f"Pipeline #{pid} has no graph configured."

        if graph.status != "failed" and not graph.error:
            return json.dumps({
                "pipeline_id": pid,
                "status": graph.status,
                "is_healthy": True,
                "message": f"Pipeline #{pid} is in '{graph.status}' state with no active execution errors."
            })

        # Error diagnosis logic
        err = graph.error or "Unknown failure"
        failed_node = None
        for n in (graph.nodes or []):
            if n.get("data", {}).get("status") == "failed":
                failed_node = n
                break

        possible_causes = []
        recommended_fix = "Review node connections and input data."
        suggested_action = None

        if "502" in err or "Gateway" in err or "Connection refused" in err:
            possible_causes = [
                "FastAPI ML Engine is currently starting or offline (port 8001).",
                "Request timeout on large dataset training."
            ]
            recommended_fix = "Ensure FastAPI service is active via: uvicorn main:app --reload --port 8001"
        elif "target" in err.lower() or "label" in err.lower():
            possible_causes = [
                "Target column is not selected in Split Dataset node.",
                "Target column name does not exist in the loaded dataset."
            ]
            recommended_fix = "Open the Split Dataset block in the Canvas and select a valid target column."
        elif "solver" in err.lower() or "penalty" in err.lower():
            possible_causes = [
                "Incompatible hyperparameter pairing: LogisticRegression with penalty='l1' requires solver='liblinear' or solver='saga'."
            ]
            recommended_fix = "Change LogisticRegression solver to 'liblinear'."
            if failed_node:
                suggested_action = {
                    "action": "update_node",
                    "node_id": failed_node.get("id"),
                    "changes": {"solver": "liblinear"},
                    "reason": "liblinear solver supports L1 regularization penalty"
                }
        else:
            possible_causes = [
                "Missing upstream dataset connection.",
                "Categorical columns not encoded before linear/SVM model.",
                "Unbalanced split without stratified sampling."
            ]
            recommended_fix = "Add an Encoder block before Split Dataset or check missing values."

        return json.dumps({
            "pipeline_id": pid,
            "status": graph.status,
            "is_healthy": False,
            "error_message": err,
            "failed_node": failed_node.get("data", {}).get("title", failed_node.get("id")) if failed_node else "Unknown",
            "possible_causes": possible_causes,
            "recommended_fix": recommended_fix,
            "suggested_action": suggested_action,
        }, indent=2)

    @tool
    def explain_node_tool(node_type: str) -> str:
        """
        Explains how a specific ML, DL, preprocessing, or evaluation node works in NeuralCanva,
        its hyperparameters, and best practices.
        """
        info = ALGORITHM_KNOWLEDGE.get(node_type)
        if not info:
            for k, v in ALGORITHM_KNOWLEDGE.items():
                if node_type.lower() in k.lower():
                    info = v
                    break

        if info:
            return json.dumps(info, indent=2)

        return json.dumps({
            "node_type": node_type,
            "title": node_type,
            "description": f"NeuralCanva execution component for '{node_type}'.",
            "how_it_works": "Executes standard scikit-learn / TensorFlow transformations within the pipeline DAG.",
            "when_to_use": ["Integrate into pipeline DAG connecting upstream data to downstream evaluators."]
        })

    return [
        analyze_dataset_tool,
        recommend_model_tool,
        explain_pipeline_error_tool,
        explain_node_tool,
    ]
