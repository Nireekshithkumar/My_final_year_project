import os
import io
import json
import base64
import zipfile
import logging
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from common.storage import StorageAbstraction
from .models import Graph, TrainedModel

logger = logging.getLogger(__name__)


class DownloadModelBundleView(APIView):
    """
    Downloads the complete model bundle as a ZIP archive.
    Includes:
      - Trained model binary (pickle / H5)
      - Features specification
      - HOW_TO_USE.txt integration guide
      - Metadata and metrics JSON
    Supports filesystem artifacts and database-stored model representations.
    Never renders blank pages or raw server paths.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            graph = Graph.objects.select_related('pipeline').get(
                pipeline_id=pk, pipeline__owner=request.user
            )
        except Graph.DoesNotExist:
            return JsonResponse({"detail": "No pipeline graph found for this ID."}, status=404)

        # Check for model in Registered TrainedModel records or Graph artifacts
        registered_model = TrainedModel.objects.filter(pipeline_id=pk, owner=request.user).first()
        artifact_dir = StorageAbstraction.get_artifact_dir(graph.id)

        model_bytes = None
        model_ext = 'pkl'
        features = []
        metrics = {}
        algorithm_name = "TrainedModel"

        # 1. Try reading from filesystem artifact dir
        if os.path.isdir(artifact_dir):
            for f in os.listdir(artifact_dir):
                if f.startswith('model.') and not f.endswith('.zip'):
                    model_ext = f.split('.')[-1]
                    try:
                        with open(os.path.join(artifact_dir, f), 'rb') as mf:
                            model_bytes = mf.read()
                        break
                    except Exception:
                        pass

            feat_file = os.path.join(artifact_dir, 'features.json')
            if os.path.isfile(feat_file):
                try:
                    with open(feat_file, 'r') as ff:
                        features = json.load(ff)
                except Exception:
                    pass

        # 2. Try reconstructing from registered model or graph node_outputs
        if not model_bytes and registered_model and registered_model.model_b64:
            try:
                model_bytes = base64.b64decode(registered_model.model_b64)
                model_ext = registered_model.model_format or 'pkl'
                features = registered_model.features or features
                metrics = registered_model.metrics or metrics
                algorithm_name = registered_model.algorithm or algorithm_name
            except Exception as e:
                logger.warning(f"Failed decoding registered model b64: {e}")

        if not model_bytes and graph.node_outputs:
            for nid, out in graph.node_outputs.items():
                if isinstance(out, dict) and 'model_b64' in out and out['model_b64']:
                    try:
                        model_bytes = base64.b64decode(out['model_b64'])
                        if 'metrics' in out:
                            metrics = out['metrics']
                        break
                    except Exception:
                        pass

        if not model_bytes:
            return JsonResponse({
                "detail": "No trained model found for this pipeline. Please connect and run a model training block first."
            }, status=404)

        # Build in-memory ZIP archive
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 1. Write model binary
            model_filename = f"model.{model_ext}"
            zf.writestr(model_filename, model_bytes)

            # 2. Write metadata
            meta_data = {
                "pipeline_id": pk,
                "pipeline_name": graph.pipeline.name,
                "algorithm": registered_model.algorithm if registered_model else algorithm_name,
                "version": registered_model.version if registered_model else 1,
                "features": features,
                "metrics": metrics or graph.result if isinstance(graph.result, dict) else {},
                "model_format": model_ext,
            }
            zf.writestr("metadata.json", json.dumps(meta_data, indent=2))

            # 3. Write features
            if features:
                zf.writestr("features.json", json.dumps(features, indent=2))

            # 4. Write other json artifact files if present in artifact_dir
            if os.path.isdir(artifact_dir):
                for fname in os.listdir(artifact_dir):
                    if fname.endswith('.json') and fname not in ('features.json', 'metadata.json'):
                        try:
                            with open(os.path.join(artifact_dir, fname), 'r') as jf:
                                zf.writestr(fname, jf.read())
                        except Exception:
                            pass

            # 5. Build HOW_TO_USE.txt
            instructions = self._build_instructions(model_filename, features, meta_data)
            zf.writestr("HOW_TO_USE.txt", instructions)

        zip_buffer.seek(0)
        safe_filename = f"model_bundle_pipeline_{pk}.zip"

        response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{safe_filename}"'
        response['Content-Length'] = zip_buffer.getbuffer().nbytes
        return response

    def _build_instructions(self, model_file, features, metadata):
        lines = [
            "==================================================",
            "NEURAL CANVAS — MODEL INFERENCE BUNDLE",
            "==================================================",
            "",
            f"Pipeline: {metadata.get('pipeline_name', 'NeuralCanvas Pipeline')}",
            f"Algorithm: {metadata.get('algorithm', 'Trained Model')}",
            f"Model File: {model_file}",
            "",
            "1. HOW TO LOAD & PREDICT (PYTHON):",
            "--------------------------------------------------",
        ]

        if model_file.endswith('.pkl'):
            lines += [
                "import pickle",
                "import numpy as np",
                "",
                "# Load the trained model",
                f"with open('{model_file}', 'rb') as f:",
                "    model = pickle.load(f)",
                "",
                "# Prepare input features matching training columns:",
                f"# Expected features ({len(features)}): {features}",
                "X_new = np.array([[...]])  # Replace with feature vector",
                "predictions = model.predict(X_new)",
                "print('Prediction:', predictions)",
            ]
        elif model_file.endswith('.h5'):
            lines += [
                "from tensorflow import keras",
                "import numpy as np",
                "",
                "# Load TensorFlow/Keras model",
                f"model = keras.models.load_model('{model_file}')",
                "X_new = np.array([[...]])",
                "predictions = model.predict(X_new)",
                "print('Prediction:', predictions)",
            ]

        lines += [
            "",
            "2. LIVE REST API PREDICTION:",
            "--------------------------------------------------",
            "If deployed via NeuralCanvas Model Registry, you can also query:",
            f"POST /api/pipelines/models/{metadata.get('pipeline_id')}/predict/",
            "Body: {\"feature_values\": {\"feature_name\": 1.0}}",
            "",
            "Generated by NeuralCanvas AI Studio.",
        ]
        return "\n".join(lines)