import pickle
import glob
import json
import numpy as np
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph
from .preprocessing_helpers import topological_sort, apply_preprocess_step
import os



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
        
        # Load final features list to check order
        features_path = f'{artifact_dir}/features.json'
        if os.path.exists(features_path):
            with open(features_path) as f:
                final_cols = json.load(f)
        else:
            final_cols = list(feature_values.keys())
        
        # Check for feature count mismatch (robustness check!)
        if len(feature_values) != len(final_cols):
            return JsonResponse({
                "error": f"Feature count mismatch: model expects {len(final_cols)} features, but {len(feature_values)} provided."
            }, status=400)
            
        # Preprocess step-by-step
        current_features = dict(feature_values)
        
        # Trace topological order to find preprocess nodes
        nodes = graph.nodes or []
        edges = graph.edges or []
        
        try:
            exec_order = topological_sort(nodes, edges)
        except Exception as e:
            return JsonResponse({"error": f"Graph sorting failed: {str(e)}"}, status=400)
            
        node_map = {n['id']: n for n in nodes}
        
        for nid in exec_order:
            n = node_map[nid]
            ntype = n['data'].get('nodeType')
            ap_path = f'{artifact_dir}/{nid}.json'
            if os.path.exists(ap_path):
                with open(ap_path) as f:
                    ap = json.load(f)
                current_features = apply_preprocess_step(ntype, ap, current_features)
                
        # Order values by final_cols
        try:
            values = [float(current_features.get(col, 0.0)) for col in final_cols]
        except (ValueError, TypeError) as e:
            return JsonResponse({"error": f"Non-numeric preprocessed feature found: {str(e)}"}, status=400)
            
        if model_path.endswith('.pkl'):
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
        else:
            from tensorflow import keras
            model = keras.models.load_model(model_path)
            
        prediction = model.predict(np.array([values]))
        pred_value = prediction.tolist()[0] if hasattr(prediction, 'tolist') else prediction[0]
        
        return JsonResponse({"prediction": pred_value})