import base64
import json
import logging
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import TrainedModel, Pipeline, Graph

logger = logging.getLogger(__name__)


class ModelRegistryListView(APIView):
    """List all registered models for the authenticated user and create/register a new model."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        models = TrainedModel.objects.filter(owner=request.user)
        data = []
        for m in models:
            data.append({
                "id": m.id,
                "name": m.name,
                "version": m.version,
                "algorithm": m.algorithm,
                "dataset_name": m.dataset_name,
                "target_column": m.target_column,
                "metrics": m.metrics,
                "features_count": len(m.features) if m.features else 0,
                "status": m.status,
                "pipeline_id": m.pipeline_id,
                "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            })
        return Response(data)

    def post(self, request):
        name = request.data.get('name', 'MyModel').strip()
        pipeline_id = request.data.get('pipeline_id')
        pipeline = get_object_or_404(Pipeline, id=pipeline_id, owner=request.user) if pipeline_id else None

        # Check existing versions
        last_version = TrainedModel.objects.filter(owner=request.user, name=name).order_by('-version').first()
        new_version = (last_version.version + 1) if last_version else 1

        algorithm = request.data.get('algorithm', 'RandomForestClassifier')
        dataset_name = request.data.get('dataset_name', '')
        target_column = request.data.get('target_column', '')
        features = request.data.get('features', [])
        metrics = request.data.get('metrics', {})
        model_b64 = request.data.get('model_b64', '')
        model_format = request.data.get('model_format', 'pkl')

        # If model_b64 not supplied, try extracting from pipeline's latest graph run
        if not model_b64 and pipeline and hasattr(pipeline, 'graph'):
            for out in pipeline.graph.node_outputs.values():
                if isinstance(out, dict) and out.get('model_b64'):
                    model_b64 = out['model_b64']
                    metrics = out.get('metrics', metrics)
                    break

        instance = TrainedModel.objects.create(
            owner=request.user,
            pipeline=pipeline,
            name=name,
            version=new_version,
            algorithm=algorithm,
            dataset_name=dataset_name,
            target_column=target_column,
            features=features,
            metrics=metrics,
            model_b64=model_b64,
            model_format=model_format,
            status='active'
        )

        return Response({
            "message": f"Model '{name}' registered successfully as version v{new_version}.",
            "id": instance.id,
            "version": instance.version,
        }, status=201)


class ModelRegistryDetailView(APIView):
    """Retrieve, rename, or delete a registered model."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, id, user):
        return get_object_or_404(TrainedModel, id=id, owner=user)

    def get(self, request, id):
        m = self.get_object(id, request.user)
        return Response({
            "id": m.id,
            "name": m.name,
            "version": m.version,
            "algorithm": m.algorithm,
            "dataset_name": m.dataset_name,
            "target_column": m.target_column,
            "features": m.features,
            "metrics": m.metrics,
            "status": m.status,
            "pipeline_id": m.pipeline_id,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        })

    def patch(self, request, id):
        m = self.get_object(id, request.user)
        new_name = request.data.get('name')
        new_status = request.data.get('status')
        if new_name:
            m.name = new_name.strip()
        if new_status:
            m.status = new_status.strip()
        m.save()
        return Response({"message": "Model updated successfully.", "id": m.id, "name": m.name, "status": m.status})

    def delete(self, request, id):
        m = self.get_object(id, request.user)
        m.delete()
        return Response({"message": "Model deleted successfully."}, status=204)
