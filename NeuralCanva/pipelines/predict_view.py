import pickle
import glob
import json
import numpy as np
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph


class PredictView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        graph = Graph.objects.get(pipeline_id=pk, pipeline__owner=request.user)
        artifact_dir = f'media/artifacts/{graph.id}'

        model_files = glob.glob(f'{artifact_dir}/model.*')
        if not model_files:
            return JsonResponse({"error": "No trained model found — run training first."}, status=400)

        model_path = model_files[0]
        feature_values = request.data.get('feature_values', {})
        columns = list(feature_values.keys())
        values = [float(feature_values[c]) for c in columns]

        if model_path.endswith('.pkl'):
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
        else:
            from tensorflow import keras
            model = keras.models.load_model(model_path)

        X_input = [values]
        scaler_files = glob.glob(f'{artifact_dir}/*.json')
        for sf in scaler_files:
            with open(sf) as f:
                sp = json.load(f)
            if 'mean' in sp:
                X_input = [[(v - m) / s for v, m, s in zip(values, sp['mean'], sp['scale'])]]
            elif 'data_min' in sp:
                X_input = [[(v - mn) / (mx - mn) for v, mn, mx in zip(values, sp['data_min'], sp['data_max'])]]

        prediction = model.predict(np.array(X_input))
        pred_value = prediction.tolist()[0] if hasattr(prediction, 'tolist') else prediction[0]

        return JsonResponse({"prediction": pred_value})