import time
import json
import base64
import pickle
import logging
import numpy as np
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import TrainedModel, Pipeline

logger = logging.getLogger(__name__)


class RegisteredModelPredictView(APIView):
    """
    Live prediction endpoint for registered models.
    Supports single JSON record or batch JSON requests.
    Measures latency and returns prediction + confidence.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        start_t = time.time()
        model_obj = get_object_or_404(TrainedModel, id=id, owner=request.user)

        if not model_obj.model_b64:
            return JsonResponse({"detail": "Model artifact is not available for this record."}, status=400)

        try:
            model_bytes = base64.b64decode(model_obj.model_b64)
            if model_obj.model_format == 'h5':
                import io
                from tensorflow import keras
                model = keras.models.load_model(io.BytesIO(model_bytes))
            else:
                model = pickle.loads(model_bytes)
        except Exception as e:
            return JsonResponse({"detail": f"Failed loading model into memory: {str(e)}"}, status=500)

        # Input data processing
        input_payload = request.data
        features = model_obj.features or []

        # If payload is a dictionary of feature key-values
        if isinstance(input_payload, dict):
            if "inputs" in input_payload and isinstance(input_payload["inputs"], list):
                # Batch list of dicts or list of lists
                batch = input_payload["inputs"]
                rows = []
                for item in batch:
                    if isinstance(item, dict):
                        rows.append([float(item.get(c, 0.0)) for c in features])
                    elif isinstance(item, list):
                        rows.append([float(v) for v in item])
                X_arr = np.array(rows)
            else:
                # Single dict
                row = [float(input_payload.get(c, 0.0)) for c in features]
                X_arr = np.array([row])
        elif isinstance(input_payload, list):
            # Direct list
            X_arr = np.array(input_payload, dtype=float)
            if len(X_arr.shape) == 1:
                X_arr = X_arr.reshape(1, -1)
        else:
            return JsonResponse({"detail": "Invalid input format. Provide a JSON object with feature keys or an 'inputs' array."}, status=400)

        try:
            preds = model.predict(X_arr)
            confidence = None
            if hasattr(model, 'predict_proba'):
                try:
                    probs = model.predict_proba(X_arr)
                    confidence = [round(float(max(p)), 4) for p in probs]
                    if len(confidence) == 1:
                        confidence = confidence[0]
                except Exception:
                    pass

            predictions_list = preds.tolist() if hasattr(preds, 'tolist') else list(preds)
            prediction_output = predictions_list[0] if len(predictions_list) == 1 else predictions_list

            latency_ms = round((time.time() - start_t) * 1000, 2)

            return Response({
                "model_id": model_obj.id,
                "model_name": model_obj.name,
                "version": model_obj.version,
                "algorithm": model_obj.algorithm,
                "prediction": prediction_output,
                "confidence": confidence,
                "latency_ms": latency_ms,
                "status_code": 200,
            })
        except Exception as e:
            return JsonResponse({"detail": f"Prediction error: {str(e)}"}, status=400)
