"""
NeuralCanva AI Agent
Orchestrates multi-provider LLM inference, LangChain tools, and structured actions.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from .providers import ProviderManager
from .context import NeuralCanvaContextManager
from .tools import create_ai_tools_for_user, ALGORITHM_KNOWLEDGE
from .schemas import (
    DatasetAnalysisResult,
    ModelRecommendationResult,
    RecommendedModelItem,
    GeneratedPipelineSpec,
    PipelineNodeSpec,
    PipelineEdgeSpec,
    PipelineDebugResult,
    NodeExplanationResult,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the NeuralCanva AI Copilot, an expert AI/ML engineer embedded inside NeuralCanva.
NeuralCanva is a visual pipeline builder where users construct ML/DL DAGs with React Flow, execute them on a FastAPI backend, and analyze metrics/EDA.

Your responsibilities:
1. Analyze user datasets using statistical metadata (rows, columns, data types, missing values, class distributions).
2. Recommend the best ML/DL algorithms with clear technical reasoning.
3. Generate structured pipeline DAGs (Load Dataset -> Preprocessing -> Split -> Model -> Evaluate -> Predict).
4. Diagnose and repair pipeline failures, explaining root causes (e.g. incompatible solvers, missing encoders, unhandled NaNs).
5. Explain every node's mathematical intuition, hyperparameters, and best practices.
6. Provide concise, friendly, developer-grade Markdown responses with emojis and clear bullet points.

CRITICAL RULES:
- Never generate arbitrary executable code that modifies databases or files directly.
- Always recommend valid NeuralCanva nodes: 'loadDataset', 'splitDataset', 'StandardScaler', 'MinMaxScaler', 'Encoder', 'RandomForestClassifier', 'GradientBoostingClassifier', 'LogisticRegression', 'SVC', 'DecisionTreeClassifier', 'LinearRegression', 'Ridge', 'Lasso', 'RandomForestRegressor', 'GradientBoostingRegressor', 'evaluate', 'predict', 'end'.
- When the user asks to build or generate a pipeline, describe the architecture and provide the structured node sequence clearly.
"""


class NeuralCanvaAgent:
    """
    Main conversational agent for NeuralCanva AI Copilot.
    """

    def __init__(self, user, dataset_id: Optional[str] = None, pipeline_id: Optional[int] = None):
        self.user = user
        self.dataset_id = dataset_id
        self.pipeline_id = pipeline_id
        self.context = NeuralCanvaContextManager.get_user_context(user, dataset_id, pipeline_id)
        self.tools = create_ai_tools_for_user(user, dataset_id, pipeline_id)
        self.model, self.provider_name = ProviderManager.get_active_model()

    def chat(self, user_message: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Processes a user message and returns text response along with any structured action payloads.
        """
        user_lower = user_message.strip().lower()

        # Check for specialized intent shortcuts or use LLM
        if "analyze" in user_lower and ("data" in user_lower or "csv" in user_lower or "dataset" in user_lower):
            return self.analyze_dataset()

        if ("recommend" in user_lower or "what model" in user_lower or "which algorithm" in user_lower or "best model" in user_lower) and "pipeline" not in user_lower:
            return self.recommend_model()

        if "create pipeline" in user_lower or "build pipeline" in user_lower or "generate pipeline" in user_lower or "make a pipeline" in user_lower:
            return self.generate_pipeline()

        if "why did" in user_lower or "failed" in user_lower or "error" in user_lower or "debug" in user_lower:
            return self.debug_pipeline()

        # General conversation with LLM or Offline Heuristics
        if self.model:
            try:
                messages = [
                    SystemMessage(content=f"{SYSTEM_PROMPT}\n\nCURRENT USER PROJECT CONTEXT:\n{json.dumps(self.context, default=str)}")
                ]
                
                # Add previous conversation turns
                if conversation_history:
                    for turn in conversation_history[-6:]:
                        role = turn.get("role") or turn.get("sender")
                        content = turn.get("content") or turn.get("text") or ""
                        if role == "user":
                            messages.append(HumanMessage(content=content))
                        elif role in ["assistant", "ai"]:
                            messages.append(AIMessage(content=content))

                messages.append(HumanMessage(content=user_message))

                # Invoke model
                response = self.model.invoke(messages)
                raw_content = response.content if hasattr(response, 'content') else response
                if isinstance(raw_content, list):
                    text_parts = []
                    for item in raw_content:
                        if isinstance(item, dict) and "text" in item:
                            text_parts.append(item["text"])
                        elif isinstance(item, str):
                            text_parts.append(item)
                        else:
                            text_parts.append(str(item))
                    reply_text = "\n".join(text_parts)
                elif isinstance(raw_content, dict) and "text" in raw_content:
                    reply_text = str(raw_content["text"])
                else:
                    reply_text = str(raw_content)

                return {
                    "text": reply_text,
                    "provider": self.provider_name,
                    "action_type": None,
                    "payload": None,
                }
            except Exception as e:
                logger.warning(f"LLM invoke failed on {self.provider_name}: {e}. Using intelligent fallback response.")

        # Fallback intelligent conversational response
        return self._generate_fallback_chat_reply(user_message)

    def analyze_dataset(self, target_dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Performs deep dataset analysis and returns structured metadata."""
        ds_context = self.context.get("dataset", {})
        ds_name = ds_context.get("name", "Unknown Dataset")
        rows = ds_context.get("rows", 0)
        cols = ds_context.get("columns", 0)
        col_types = ds_context.get("column_types", {})
        num_cols = ds_context.get("numeric_columns", [])
        cat_cols = ds_context.get("categorical_columns", [])
        missing_dict = ds_context.get("missing_values", {})
        missing_count = sum(missing_dict.values()) if isinstance(missing_dict, dict) else 0
        total_cells = (rows * cols) or 1
        missing_pct = round((missing_count / total_cells) * 100, 2)
        task = ds_context.get("suggested_task", "classification")
        recommended_target = ds_context.get("recommended_target")

        # Build clean markdown
        # Format numerical & categorical lists
        num_display = ", ".join(num_cols[:6]) + ("..." if len(num_cols) > 6 else "")
        cat_display = ", ".join(cat_cols[:6]) + ("..." if len(cat_cols) > 6 else "") if cat_cols else "None detected"
        missing_status = f"**{missing_count}** cells ({missing_pct}%)" if missing_count > 0 else "✅ **0** cells (0.0%) — clean dataset"
        impute_step = "Impute missing values using mean/median for numerical, most-frequent for categorical." if missing_pct > 0 else "No missing-value treatment is required."
        encode_step = "Encode categorical features using **One-Hot Encoding** or **Label Encoding**." if cat_cols else "All features are numerical — encoding not required."

        markdown = f"""## 📊 Dataset Analysis

### {ds_name}

**{rows:,} rows × {cols} columns**

---

#### 📋 Feature Overview

🔢 **Numerical Features — {len(num_cols)}**
{num_display}

🏷️ **Categorical Features — {len(cat_cols)}**
{cat_display}

✅ **Missing Data — {missing_status}**

🎯 **Target Column — {recommended_target or 'Not selected'}**

🤖 **Predicted ML Task — {task.capitalize()}**

---

## 💡 Recommended Preprocessing

**1. Missing Values**
{impute_step}

**2. Encode Categorical Features**
{encode_step}

**3. Scale Numerical Features**
Apply `StandardScaler` for scale-sensitive models (Logistic Regression, SVM, KNN).
"""

        return {
            "text": markdown,
            "provider": self.provider_name,
            "action_type": "dataset_analysis",
            "payload": {
                "dataset_id": ds_context.get("id"),
                "dataset_name": ds_name,
                "rows": rows,
                "columns": cols,
                "numerical_count": len(num_cols),
                "categorical_count": len(cat_cols),
                "missing_pct": missing_pct,
                "task": task,
                "target": recommended_target,
            }
        }

    def recommend_model(self) -> Dict[str, Any]:
        """Recommends models based on active dataset profile."""
        ds_context = self.context.get("dataset", {})
        task = ds_context.get("suggested_task", "classification")
        target = ds_context.get("recommended_target", "Target Column")
        rows = ds_context.get("rows", 1000)

        if "regress" in task.lower():
            top = {
                "name": "RandomForestRegressor",
                "category": "ML / Ensemble",
                "reasons": [
                    "Best non-linear accuracy on tabular data without scaling.",
                    "Robust against target outliers.",
                    "Calculates feature importance ranking."
                ]
            }
            alts = [
                {"name": "GradientBoostingRegressor", "reasons": ["Sequential residual reduction for higher precision."]},
                {"name": "LinearRegression", "reasons": ["Fast interpretable linear baseline."]}
            ]
        else:
            top = {
                "name": "RandomForestClassifier",
                "category": "ML / Ensemble",
                "reasons": [
                    "Superior performance across diverse tabular domains.",
                    "Resistant to overfitting and handles mixed feature scales.",
                    "Built-in feature importance interpretation."
                ]
            }
            alts = [
                {"name": "GradientBoostingClassifier", "reasons": ["High AUC / precision on structured classifications."]},
                {"name": "LogisticRegression", "reasons": ["Fast, probabilistic classification with odds ratios."]}
            ]

        markdown = f"""### 🏆 Model Recommendation for `{task.capitalize()}`

**Top Recommended Algorithm:** **`{top['name']}`**

#### 🎯 Why this model was chosen:
{chr(10).join(f"- {r}" for r in top['reasons'])}

#### 🔄 Alternative Candidates:
{chr(10).join(f"- **`{a['name']}`:** {a['reasons'][0]}" for a in alts)}

**Recommended Metric:** {"R² Score & RMSE" if "regress" in task else "Accuracy & F1-Score"}
"""

        return {
            "text": markdown,
            "provider": self.provider_name,
            "action_type": "model_recommendation",
            "payload": {
                "top_model": top["name"],
                "task": task,
                "target": target,
                "reasons": top["reasons"],
                "alternatives": [a["name"] for a in alts],
            }
        }

    def generate_pipeline(self) -> Dict[str, Any]:
        """Generates a complete, verified DAG specification ready to apply to the canvas."""
        ds_context = self.context.get("dataset", {})
        ds_id = ds_context.get("id")
        ds_name = ds_context.get("name", "Active Dataset")
        task = ds_context.get("suggested_task", "classification")
        cols_raw = ds_context.get("columns")
        cols_list = [str(c).strip() for c in cols_raw] if isinstance(cols_raw, list) else (
            [str(c).strip() for c in (ds_context.get("columns_list") or list(ds_context.get("column_types", {}).keys()))] or ["target"]
        )
        rec_target = ds_context.get("recommended_target")
        target = str(rec_target).strip() if rec_target else (cols_list[-1] if cols_list else "target")
        cat_cols = ds_context.get("categorical_columns", [])
        is_regression = "regress" in task.lower()
        model_type = "RandomForestRegressor" if is_regression else "RandomForestClassifier"

        # Construct nodes with full visual and handle metadata
        NODE_STYLE_MAP = {
            "start": {"icon": "▶", "color": "#22c55e"},
            "loadDataset": {"icon": "📂", "color": "#ff0071"},
            "Encoder": {"icon": "🔠", "color": "#a855f7"},
            "splitDataset": {"icon": "✂", "color": "#f59e0b"},
            "RandomForestClassifier": {"icon": "🌲", "color": "#6366f1"},
            "RandomForestRegressor": {"icon": "🌲", "color": "#0ea5e9"},
            "evaluate": {"icon": "📊", "color": "#ff85be"},
            "predict": {"icon": "🎯", "color": "#22c55e"},
            "end": {"icon": "■", "color": "#ef4444"},
        }

        def make_outputs(ntype):
            if ntype == "end":
                return []
            return [{"id": "next", "label": "Connection Task", "color": "#22c55e"}]

        nodes = [
            {
                "id": "node_1",
                "node_type": "start",
                "label": "Start Task",
                "icon": NODE_STYLE_MAP["start"]["icon"],
                "iconColor": NODE_STYLE_MAP["start"]["color"],
                "outputs": make_outputs("start"),
                "params": {},
                "position": {"x": 50, "y": 200},
            },
            {
                "id": "node_2",
                "node_type": "loadDataset",
                "label": f"Load: {ds_name}",
                "icon": NODE_STYLE_MAP["loadDataset"]["icon"],
                "iconColor": NODE_STYLE_MAP["loadDataset"]["color"],
                "outputs": make_outputs("loadDataset"),
                "params": {"dataset_id": ds_id, "datasetId": ds_id},
                "position": {"x": 290, "y": 200},
            },
        ]

        current_x = 530
        curr_id = 3

        if cat_cols:
            nodes.append({
                "id": f"node_{curr_id}",
                "node_type": "Encoder",
                "label": "Categorical Encoder",
                "icon": NODE_STYLE_MAP["Encoder"]["icon"],
                "iconColor": NODE_STYLE_MAP["Encoder"]["color"],
                "outputs": make_outputs("Encoder"),
                "params": {"method": "label"},
                "position": {"x": current_x, "y": 200},
            })
            current_x += 240
            curr_id += 1

        nodes.append({
            "id": f"node_{curr_id}",
            "node_type": "splitDataset",
            "label": f"Split Dataset (Target: {target})",
            "icon": NODE_STYLE_MAP["splitDataset"]["icon"],
            "iconColor": NODE_STYLE_MAP["splitDataset"]["color"],
            "outputs": make_outputs("splitDataset"),
            "params": {"test_size": 0.2, "target_column": target, "target": target},
            "position": {"x": current_x, "y": 200},
        })
        current_x += 240
        curr_id += 1

        nodes.append({
            "id": f"node_{curr_id}",
            "node_type": model_type,
            "label": model_type,
            "icon": NODE_STYLE_MAP.get(model_type, {}).get("icon", "🌲"),
            "iconColor": NODE_STYLE_MAP.get(model_type, {}).get("color", "#6366f1"),
            "outputs": make_outputs(model_type),
            "params": {"n_estimators": 100},
            "position": {"x": current_x, "y": 200},
        })
        current_x += 240
        curr_id += 1

        nodes.append({
            "id": f"node_{curr_id}",
            "node_type": "evaluate",
            "label": "Evaluate Metrics",
            "icon": NODE_STYLE_MAP["evaluate"]["icon"],
            "iconColor": NODE_STYLE_MAP["evaluate"]["color"],
            "outputs": make_outputs("evaluate"),
            "params": {},
            "position": {"x": current_x, "y": 200},
        })
        current_x += 240
        curr_id += 1

        nodes.append({
            "id": f"node_{curr_id}",
            "node_type": "predict",
            "label": "Live Prediction API",
            "icon": NODE_STYLE_MAP["predict"]["icon"],
            "iconColor": NODE_STYLE_MAP["predict"]["color"],
            "outputs": make_outputs("predict"),
            "params": {},
            "position": {"x": current_x, "y": 200},
        })
        current_x += 240
        curr_id += 1

        nodes.append({
            "id": f"node_{curr_id}",
            "node_type": "end",
            "label": "End Task",
            "icon": NODE_STYLE_MAP["end"]["icon"],
            "iconColor": NODE_STYLE_MAP["end"]["color"],
            "outputs": make_outputs("end"),
            "params": {},
            "position": {"x": current_x, "y": 200},
        })

        # Construct sequential edges connecting output handle to next node target
        edges = []
        for i in range(len(nodes) - 1):
            src_id = nodes[i]["id"]
            tgt_id = nodes[i + 1]["id"]
            edges.append({
                "id": f"e_{src_id}_{tgt_id}",
                "source": src_id,
                "target": tgt_id,
                "sourceHandle": "next",
                "targetHandle": None,
                "type": "smoothstep",
                "animated": True,
            })

        markdown = f"""### ⚡ AI-Generated Pipeline Specification

I designed an optimized **{task.capitalize()} Pipeline** for `{ds_name}`:

```
[Start] ➔ [Load Dataset] ➔ {"[Encoder] ➔ " if cat_cols else ""}[Split Dataset] ➔ [{model_type}] ➔ [Evaluate] ➔ [Predict] ➔ [End]
```

- **Target Variable:** `{target}`
- **Test Split:** `20% (test_size = 0.2)`
- **Model Engine:** `{model_type}` (100 estimators)
- **Validation:** Automated test set scoring + confusion matrix / residuals
- **Connections:** **{len(edges)} automated edges** connecting all pipeline stages in sequence.

Click **`Apply to Canvas`** below to load this pipeline with all nodes and connections into your React Flow canvas!
"""

        return {
            "text": markdown,
            "provider": self.provider_name,
            "action_type": "generate_pipeline",
            "payload": {
                "task_type": task,
                "target_column": target,
                "dataset_id": ds_id,
                "dataset_name": ds_name,
                "nodes": nodes,
                "edges": edges,
            }
        }

    def debug_pipeline(self) -> Dict[str, Any]:
        """Inspects pipeline status, failed blocks, and hyperparameter incompatibilities."""
        pipe_context = self.context.get("pipeline", {})
        status = pipe_context.get("status", "idle")
        err = pipe_context.get("error", "")
        failed_node = pipe_context.get("failed_node")
        pid = pipe_context.get("id", 1)

        if status != "failed" and not err:
            return {
                "text": f"✅ **Pipeline #{pid} is Healthy:** Status is currently `{status}` with no active errors recorded in the graph traceback.",
                "provider": self.provider_name,
                "action_type": None,
                "payload": None,
            }

        # Analyze error
        possible_causes = []
        recommended_fix = ""
        suggested_action = None

        if "solver" in str(err).lower() or "penalty" in str(err).lower():
            possible_causes = [
                "Logistic Regression hyperparameter mismatch: `penalty='l1'` requires `solver='liblinear'` or `'saga'`."
            ]
            recommended_fix = "Change solver from `lbfgs` to `liblinear` in the Logistic Regression node configuration."
            if failed_node:
                suggested_action = {
                    "action": "update_node",
                    "node_id": failed_node.get("id"),
                    "changes": {"solver": "liblinear"},
                    "reason": "liblinear supports L1 penalty regularization."
                }
        elif "target" in str(err).lower() or "label" in str(err).lower():
            possible_causes = [
                "No target column selected in the Split Dataset node.",
                "Target column name does not match any column in the attached CSV."
            ]
            recommended_fix = "Click on the Split Dataset node and select a target column."
        elif "502" in str(err) or "connection" in str(err).lower():
            possible_causes = [
                "FastAPI ML Engine (port 8001) is offline or still initializing."
            ]
            recommended_fix = "Run `uvicorn main:app --reload --port 8001` in the FAST_API_SERVICE folder."
        else:
            possible_causes = [
                "Input dataset missing or unattached to the upstream node.",
                "Unencoded string values passed to a continuous model."
            ]
            recommended_fix = "Ensure all blocks are connected in sequence and add an Encoder block if needed."

        markdown = f"""### 🔍 Pipeline Debug Diagnosis (Pipeline #{pid})

- **Status:** ❌ **FAILED**
- **Failed Block:** `{failed_node.get('title', 'Unknown') if failed_node else 'Execution Step'}`
- **Raw Error:** `{err}`

#### 🔬 Root Cause:
{chr(10).join(f"- {c}" for c in possible_causes)}

#### 🛠️ Recommended Fix:
{recommended_fix}
"""

        return {
            "text": markdown,
            "provider": self.provider_name,
            "action_type": "debug_pipeline",
            "payload": {
                "pipeline_id": pid,
                "error": err,
                "failed_node": failed_node,
                "suggested_action": suggested_action,
            }
        }

    def _generate_fallback_chat_reply(self, message: str) -> Dict[str, Any]:
        """Provides rich context-aware answers when no LLM API key is present."""
        ds_name = self.context.get("dataset", {}).get("name", "your dataset")
        pipe_id = self.context.get("pipeline", {}).get("id", "your pipeline")

        return {
            "text": f"🤖 **NeuralCanva AI Copilot:** I am monitoring **`{ds_name}`** and **Pipeline #{pipe_id}**.\n\nYou can ask me to:\n- 📊 **Analyze Dataset:** Compute statistics, missing values, and target suggestions\n- 🏆 **Recommend Model:** Select best classifier/regressor with reasoning\n- ⚡ **Build Pipeline:** Auto-generate complete React Flow DAG\n- 🔍 **Debug Pipeline:** Traceback root cause and hyperparameter fixes\n- 📈 **Explain Node:** Learn mathematical intuition for any algorithm",
            "provider": self.provider_name,
            "action_type": None,
            "payload": None,
        }
