import json
import logging
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Pipeline, Graph

logger = logging.getLogger(__name__)


class ExportProjectView(APIView):
    """Exports pipeline architecture, nodes, edges, and metadata as a portable JSON project."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        graph = get_object_or_404(Graph, pipeline=pipeline)

        project_bundle = {
            "schema_version": "neuralcanvas.v1",
            "pipeline": {
                "name": pipeline.name,
                "description": pipeline.description,
            },
            "graph": {
                "nodes": graph.nodes,
                "edges": graph.edges,
            },
            "exported_at": graph.updated_at.isoformat() if graph.updated_at else "",
        }

        safe_name = pipeline.name.lower().replace(" ", "_")
        filename = f"neuralcanvas_project_{safe_name}_{pk}.json"

        response = HttpResponse(json.dumps(project_bundle, indent=2), content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ImportProjectView(APIView):
    """Imports and reconstructs a pipeline and graph from exported JSON project structure."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        if not isinstance(data, dict) or "graph" not in data:
            return JsonResponse({"detail": "Invalid project file format. Expected 'graph' configuration."}, status=400)

        pipeline_info = data.get("pipeline", {})
        graph_info = data.get("graph", {})

        base_name = pipeline_info.get("name", "Imported Pipeline")
        new_name = f"{base_name} (Imported)"
        desc = pipeline_info.get("description", "Imported from NeuralCanvas project file")

        pipeline = Pipeline.objects.create(
            owner=request.user,
            name=new_name,
            description=desc
        )

        Graph.objects.create(
            pipeline=pipeline,
            nodes=graph_info.get("nodes", []),
            edges=graph_info.get("edges", []),
            status='idle'
        )

        return JsonResponse({
            "message": "Project imported successfully.",
            "pipeline_id": pipeline.id,
            "name": pipeline.name
        }, status=201)
