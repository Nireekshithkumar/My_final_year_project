"""
NeuralCanva AI REST API Views
Secure, authenticated endpoints for AI Copilot chat, analysis, generation, and safe execution.
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from accounts.authentication import CsrfExemptSessionAuthentication
from pipelines.models import Pipeline, Graph
from datasets.models import Dataset
from .agent import NeuralCanvaAgent
from .context import NeuralCanvaContextManager
from .providers import ProviderManager
from .tools import ALGORITHM_KNOWLEDGE

logger = logging.getLogger(__name__)


class StatusAPIView(APIView):
    """Returns the online health status and active provider for the UI indicator."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(ProviderManager.get_status())


class ContextAPIView(APIView):
    """Fetches complete user project context snapshot."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        dataset_id = request.GET.get("dataset_id")
        pipeline_id = request.GET.get("pipeline_id")
        if pipeline_id:
            try:
                pipeline_id = int(pipeline_id)
            except ValueError:
                pipeline_id = None

        context = NeuralCanvaContextManager.get_user_context(
            user=request.user,
            dataset_id=dataset_id,
            pipeline_id=pipeline_id
        )
        return Response(context)


class ChatAPIView(APIView):
    """Primary chat endpoint for NeuralCanva AI Copilot."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        if not message:
            return Response({"error": "Message cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        dataset_id = request.data.get("dataset_id")
        pipeline_id = request.data.get("pipeline_id")
        history = request.data.get("history", [])

        if pipeline_id:
            try:
                pipeline_id = int(pipeline_id)
            except (ValueError, TypeError):
                pipeline_id = None

        agent = NeuralCanvaAgent(
            user=request.user,
            dataset_id=dataset_id,
            pipeline_id=pipeline_id
        )

        result = agent.chat(user_message=message, conversation_history=history)
        return Response(result)


class AnalyzeDatasetAPIView(APIView):
    """Performs full statistical dataset analysis & task identification."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        dataset_id = request.data.get("dataset_id")
        agent = NeuralCanvaAgent(user=request.user, dataset_id=dataset_id)
        result = agent.analyze_dataset(target_dataset_id=dataset_id)
        return Response(result)


class RecommendModelAPIView(APIView):
    """Generates ranked ML/DL model recommendations with explanations."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        dataset_id = request.data.get("dataset_id")
        agent = NeuralCanvaAgent(user=request.user, dataset_id=dataset_id)
        result = agent.recommend_model()
        return Response(result)


class GeneratePipelineAPIView(APIView):
    """Generates a structured React Flow DAG specification."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        dataset_id = request.data.get("dataset_id")
        agent = NeuralCanvaAgent(user=request.user, dataset_id=dataset_id)
        result = agent.generate_pipeline()
        return Response(result)


class DebugPipelineAPIView(APIView):
    """Diagnoses failed pipeline runs and suggests hyperparameter/structural fixes."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        pipeline_id = request.data.get("pipeline_id")
        if pipeline_id:
            try:
                pipeline_id = int(pipeline_id)
            except (ValueError, TypeError):
                pipeline_id = None

        agent = NeuralCanvaAgent(user=request.user, pipeline_id=pipeline_id)
        result = agent.debug_pipeline()
        return Response(result)


class ExplainNodeAPIView(APIView):
    """Returns in-depth documentation, hyperparameters guide, and intuition for a node."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        node_type = request.data.get("node_type", "").strip()
        if not node_type:
            return Response({"error": "node_type is required"}, status=status.HTTP_400_BAD_REQUEST)

        info = ALGORITHM_KNOWLEDGE.get(node_type)
        if not info:
            for k, v in ALGORITHM_KNOWLEDGE.items():
                if node_type.lower() in k.lower():
                    info = v
                    break

        if not info:
            info = {
                "title": node_type,
                "category": "Machine Learning / Data Processing",
                "description": f"Standard transformation component for '{node_type}'.",
                "how_it_works": "Processes input arrays through verified algorithms and passes artifacts to downstream nodes.",
                "when_to_use": ["Incorporate into your pipeline workflow."],
                "hyperparameters_guide": {},
                "best_practices": ["Check input data types before running."],
            }

        return Response(info)


class OptimizePipelineAPIView(APIView):
    """Suggests performance tuning, feature scaling, and ensemble additions for an active pipeline."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        pipeline_id = request.data.get("pipeline_id")
        agent = NeuralCanvaAgent(user=request.user, pipeline_id=pipeline_id)
        pipe = agent.context.get("pipeline", {})
        models = pipe.get("active_models", [])

        tips = [
            "⚡ **Feature Scaling:** Ensure continuous inputs are standardized with `StandardScaler` if using linear or neural models.",
            "🌳 **Ensemble Boost:** If using `DecisionTreeClassifier`, upgrade to `RandomForestClassifier` or `GradientBoostingClassifier` for higher generalization.",
            "📊 **Cross-Validation:** Increase dataset sample size or use stratified 80/20 train/test splits.",
            "🤖 **AutoML Benchmark:** Run 1-Click AutoML in the top toolbar to find optimal hyperparameter boundaries."
        ]

        return Response({
            "pipeline_id": pipeline_id,
            "optimization_summary": f"Analyzed {len(pipe.get('nodes_summary', []))} nodes with models: {', '.join(models) if models else 'None'}.",
            "recommendations": tips,
        })


class ApplyActionAPIView(APIView):
    """
    Safely applies validated AI actions (creating a pipeline DAG or updating node parameters)
    ONLY upon explicit user confirmation from the frontend.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        action = request.data.get("action")
        payload = request.data.get("payload", {})

        if action == "apply_generated_pipeline":
            # Creates or updates a pipeline with the generated nodes & edges
            pipeline_name = payload.get("pipeline_name", "AI Generated Pipeline")
            target_pipeline_id = payload.get("pipeline_id")

            if target_pipeline_id:
                pipeline = get_object_or_404(Pipeline, id=target_pipeline_id, owner=request.user)
            else:
                pipeline = Pipeline.objects.create(
                    name=pipeline_name,
                    description=f"Generated by AI Copilot for {payload.get('task_type', 'ML')} task",
                    owner=request.user
                )

            graph, _ = Graph.objects.get_or_create(pipeline=pipeline)

            # Convert AI node specs to React Flow compatible format
            rf_nodes = []
            for n in payload.get("nodes", []):
                nid = n.get("id")
                ntype = n.get("node_type")
                label = n.get("label", ntype)
                rf_nodes.append({
                    "id": nid,
                    "type": "taskNode",
                    "position": n.get("position", {"x": 200, "y": 200}),
                    "data": {
                        "nodeType": ntype,
                        "title": label,
                        "subtitle": label,
                        "params": n.get("params", {}),
                        "datasetId": n.get("params", {}).get("datasetId") or payload.get("dataset_id"),
                        "dataset_id": n.get("params", {}).get("dataset_id") or payload.get("dataset_id"),
                        "status": "ready",
                        "checked": True,
                    }
                })

            rf_edges = []
            for idx, e in enumerate(payload.get("edges", [])):
                rf_edges.append({
                    "id": f"e_{e['source']}_{e['target']}_{idx}",
                    "source": e["source"],
                    "target": e["target"],
                    "animated": True,
                })

            graph.nodes = rf_nodes
            graph.edges = rf_edges
            graph.status = "idle"
            graph.error = ""
            graph.save()

            return Response({
                "success": True,
                "message": f"Pipeline #{pipeline.id} successfully created!",
                "pipeline_id": pipeline.id,
            })

        elif action == "update_node_params":
            # Safely modifies parameters of a specific node
            pipeline_id = payload.get("pipeline_id")
            node_id = payload.get("node_id")
            changes = payload.get("changes", {})

            if not pipeline_id or not node_id:
                return Response({"error": "pipeline_id and node_id are required"}, status=status.HTTP_400_BAD_REQUEST)

            pipeline = get_object_or_404(Pipeline, id=pipeline_id, owner=request.user)
            graph = get_object_or_404(Graph, pipeline=pipeline)

            updated = False
            for n in (graph.nodes or []):
                if n.get("id") == node_id:
                    data = n.setdefault("data", {})
                    params = data.setdefault("params", {})
                    params.update(changes)
                    data["status"] = "ready"
                    updated = True
                    break

            if updated:
                graph.error = ""
                graph.status = "idle"
                graph.save()
                return Response({
                    "success": True,
                    "message": f"Node '{node_id}' parameters updated successfully.",
                    "pipeline_id": pipeline.id,
                })
            else:
                return Response({"error": f"Node '{node_id}' not found in pipeline graph."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"error": f"Unsupported action: {action}"}, status=status.HTTP_400_BAD_REQUEST)
