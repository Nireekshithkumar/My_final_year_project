import os
import zipfile
from django.http import FileResponse, Http404
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph


class DownloadModelBundleView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            graph = Graph.objects.get(pipeline_id=pk, pipeline__owner=request.user)
        except Graph.DoesNotExist:
            raise Http404("No graph found for this pipeline.")

        artifact_dir = f'media/artifacts/{graph.id}'
        if not os.path.isdir(artifact_dir):
            raise Http404("No artifacts found — run the pipeline first.")

        files = os.listdir(artifact_dir)
        instructions = self._build_instructions(files)
        with open(f'{artifact_dir}/HOW_TO_USE.txt', 'w') as f:
            f.write(instructions)

        zip_path = f'{artifact_dir}/bundle.zip'
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for fname in os.listdir(artifact_dir):
                if fname != 'bundle.zip':
                    zf.write(os.path.join(artifact_dir, fname), fname)

        return FileResponse(open(zip_path, 'rb'), as_attachment=True, filename=f'model_bundle_{pk}.zip')

    def _build_instructions(self, files):
        model_file = next((f for f in files if f.startswith('model.')), None)
        scaler_files = [f for f in files if f != model_file and f.endswith('.json')]

        lines = ["NEURAL CANVAS — MODEL BUNDLE\n", "=" * 40, ""]

        if model_file and model_file.endswith('.pkl'):
            lines += [
                "MODEL (scikit-learn, pickle format):",
                "    import pickle",
                f"    with open('{model_file}', 'rb') as f:",
                "        model = pickle.load(f)",
                "    predictions = model.predict(X_new)",
                "",
            ]
        elif model_file and model_file.endswith('.h5'):
            lines += [
                "MODEL (Keras / TensorFlow, H5 format):",
                "    from tensorflow import keras",
                f"    model = keras.models.load_model('{model_file}')",
                "    predictions = model.predict(X_new)",
                "",
            ]

        for sf in scaler_files:
            name = sf.replace('.json', '')
            lines += [
                f"{name.upper()} (JSON params — reconstruct manually):",
                "    import json, numpy as np",
                f"    with open('{sf}') as f:",
                "        params = json.load(f)",
                "    # For StandardScaler: X_scaled = (X_new - mean) / scale",
                "",
            ]

        lines.append("IMPORTANT: Preprocess new input through the scaler/encoder in the")
        lines.append("same order used during training, before calling model.predict().")
        return "\n".join(lines)