import os
import io
import json
import base64
import pickle
import textwrap
import zipfile
import logging
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from common.storage import StorageAbstraction
from .models import Graph, TrainedModel

logger = logging.getLogger(__name__)


def _load_model_artifacts(pk, request_user):
    """
    Shared helper: resolves model bytes, features, metrics and algorithm name
    from filesystem, TrainedModel registry, or Graph.node_outputs.
    Returns a dict or None if nothing found.
    """
    try:
        graph = Graph.objects.select_related('pipeline').get(
            pipeline_id=pk, pipeline__owner=request_user
        )
    except Graph.DoesNotExist:
        return None

    registered_model = TrainedModel.objects.filter(pipeline_id=pk, owner=request_user).first()
    artifact_dir = StorageAbstraction.get_artifact_dir(graph.id)

    model_bytes = None
    model_ext = 'pkl'
    features = []
    metrics = {}
    algorithm_name = "TrainedModel"

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
                    if 'features' in out and out['features']:
                        features = out['features']
                    break
                except Exception:
                    pass

    if not model_bytes:
        return None

    if registered_model:
        algorithm_name = registered_model.algorithm or algorithm_name
        metrics = registered_model.metrics or metrics
        features = registered_model.features or features

    return {
        "graph": graph,
        "model_bytes": model_bytes,
        "model_ext": model_ext,
        "features": features,
        "metrics": metrics,
        "algorithm_name": algorithm_name,
        "pipeline_name": graph.pipeline.name,
    }


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


class DownloadONNXView(APIView):
    """
    Exports the trained sklearn/XGBoost/LightGBM model as an ONNX file.

    Requires: skl2onnx (for sklearn), onnxmltools (for XGBoost/LGBM).
    Falls back to a descriptive 404 with instructions when packages are absent.

    GET /api/pipelines/<pk>/download/onnx/
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        artifacts = _load_model_artifacts(pk, request.user)
        if artifacts is None:
            return JsonResponse({
                "detail": (
                    "No trained model found for this pipeline. "
                    "Run a model training block first."
                )
            }, status=404)

        model_bytes = artifacts["model_bytes"]
        model_ext = artifacts["model_ext"]
        features = artifacts["features"]
        algorithm_name = artifacts["algorithm_name"]
        pipeline_name = artifacts["pipeline_name"]

        if model_ext != "pkl":
            return JsonResponse({
                "detail": (
                    f"ONNX export is only supported for sklearn pickle models "
                    f"(this pipeline uses '{model_ext}'). "
                    "Deep learning H5 models can be exported via tf2onnx separately."
                )
            }, status=422)

        # Deserialise the sklearn model
        try:
            model_obj = pickle.loads(model_bytes)
        except Exception as exc:
            logger.exception("Failed to deserialise model for ONNX export")
            return JsonResponse({"detail": f"Model deserialisation failed: {exc}"}, status=500)

        # Attempt ONNX conversion
        try:
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType

            n_features = len(features) if features else None
            if n_features is None:
                try:
                    n_features = model_obj.n_features_in_
                except AttributeError:
                    n_features = 1

            initial_type = [("float_input", FloatTensorType([None, n_features]))]
            onnx_model = convert_sklearn(model_obj, initial_types=initial_type)
            onnx_bytes = onnx_model.SerializeToString()

        except ImportError:
            return JsonResponse({
                "detail": (
                    "ONNX export requires 'skl2onnx'. "
                    "Install it in the NeuralCanvas environment with:\n"
                    "  pip install skl2onnx\n"
                    "Then retry this download."
                )
            }, status=501)
        except Exception as exc:
            logger.exception("ONNX conversion failed")
            return JsonResponse({
                "detail": (
                    f"ONNX conversion failed for algorithm '{algorithm_name}': {exc}. "
                    "Some custom pipeline estimators may not be supported by skl2onnx."
                )
            }, status=500)

        safe_name = pipeline_name.replace(" ", "_").lower()
        filename = f"{safe_name}_model.onnx"
        response = HttpResponse(onnx_bytes, content_type="application/octet-stream")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = len(onnx_bytes)
        return response


class DownloadInferScriptView(APIView):
    """
    Generates and downloads a self-contained Python inference script bundle.

    The ZIP contains:
      - model.pkl          — original trained model
      - infer.py           — zero-dependency inference script (only stdlib + sklearn)
      - requirements.txt   — pinned dependencies for reproducibility
      - README.md          — usage instructions

    GET /api/pipelines/<pk>/download/script/
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        artifacts = _load_model_artifacts(pk, request.user)
        if artifacts is None:
            return JsonResponse({
                "detail": (
                    "No trained model found for this pipeline. "
                    "Run a model training block first."
                )
            }, status=404)

        model_bytes = artifacts["model_bytes"]
        model_ext = artifacts["model_ext"]
        features = artifacts["features"]
        metrics = artifacts["metrics"]
        algorithm_name = artifacts["algorithm_name"]
        pipeline_name = artifacts["pipeline_name"]

        feature_list_repr = json.dumps(features, indent=4)
        metrics_repr = json.dumps(metrics, indent=4)

        is_keras = model_ext in ("h5", "keras")

        if is_keras:
            infer_script = textwrap.dedent(f"""\
                #!/usr/bin/env python3
                \"\"\"
                NeuralCanvas — Auto-generated Inference Script
                Pipeline : {pipeline_name}
                Algorithm: {algorithm_name}
                Features : {len(features)} columns

                Usage:
                    python infer.py --input data.csv --output predictions.csv
                    python infer.py --values 1.0 2.5 0.3 ...
                \"\"\"
                import argparse
                import json
                import sys
                import numpy as np

                MODEL_FILE = "model.{model_ext}"
                FEATURES = {feature_list_repr}
                TRAINING_METRICS = {metrics_repr}


                def load_model():
                    from tensorflow import keras
                    return keras.models.load_model(MODEL_FILE)


                def predict(model, X):
                    return model.predict(np.array(X)).tolist()


                def main():
                    parser = argparse.ArgumentParser(description="NeuralCanvas inference runner")
                    parser.add_argument("--input", help="Path to CSV file with feature columns")
                    parser.add_argument("--output", default="predictions.csv", help="Output CSV path")
                    parser.add_argument("--values", nargs="+", type=float,
                                        help="Single-row feature values (space-separated)")
                    args = parser.parse_args()

                    model = load_model()

                    if args.values:
                        X = [args.values]
                        preds = predict(model, X)
                        print(f"Prediction: {{preds}}")
                    elif args.input:
                        import csv
                        rows = []
                        with open(args.input) as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                rows.append([float(row.get(c, 0)) for c in FEATURES])
                        preds = predict(model, rows)
                        with open(args.output, "w", newline="") as f:
                            writer = csv.writer(f)
                            writer.writerow(["prediction"])
                            for p in preds:
                                writer.writerow([p])
                        print(f"Predictions written to {{args.output}}")
                    else:
                        print("Provide --input or --values. See --help for details.")
                        sys.exit(1)


                if __name__ == "__main__":
                    main()
            """)
            requirements = textwrap.dedent("""\
                tensorflow>=2.12
                numpy>=1.23
            """)
        else:
            infer_script = textwrap.dedent(f"""\
                #!/usr/bin/env python3
                \"\"\"
                NeuralCanvas — Auto-generated Inference Script
                Pipeline : {pipeline_name}
                Algorithm: {algorithm_name}
                Features : {len(features)} columns

                Usage:
                    python infer.py --input data.csv --output predictions.csv
                    python infer.py --values 1.0 2.5 0.3 ...
                \"\"\"
                import argparse
                import pickle
                import json
                import sys
                import numpy as np

                MODEL_FILE = "model.pkl"
                FEATURES = {feature_list_repr}
                TRAINING_METRICS = {metrics_repr}


                def load_model():
                    with open(MODEL_FILE, "rb") as f:
                        return pickle.load(f)


                def predict(model, X):
                    arr = np.array(X, dtype=float)
                    return model.predict(arr).tolist()


                def predict_proba(model, X):
                    arr = np.array(X, dtype=float)
                    if hasattr(model, "predict_proba"):
                        return model.predict_proba(arr).tolist()
                    return None


                def main():
                    parser = argparse.ArgumentParser(description="NeuralCanvas inference runner")
                    parser.add_argument("--input", help="Path to CSV file with feature columns")
                    parser.add_argument("--output", default="predictions.csv", help="Output CSV path")
                    parser.add_argument("--values", nargs="+", type=float,
                                        help="Single-row feature values (space-separated)")
                    parser.add_argument("--proba", action="store_true",
                                        help="Output class probabilities (classifiers only)")
                    args = parser.parse_args()

                    print(f"Loading model from {{MODEL_FILE}} ...")
                    model = load_model()

                    if args.values:
                        X = [args.values]
                        if len(FEATURES) and len(args.values) != len(FEATURES):
                            print(f"Warning: expected {{len(FEATURES)}} features, got {{len(args.values)}}")
                        preds = predict_proba(model, X) if args.proba else predict(model, X)
                        label = "Probabilities" if args.proba else "Prediction"
                        print(f"{{label}}: {{preds[0]}}")

                    elif args.input:
                        import csv
                        rows = []
                        with open(args.input, newline="") as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                rows.append([float(row.get(c, 0)) for c in (FEATURES or reader.fieldnames)])
                        preds = predict_proba(model, rows) if args.proba else predict(model, rows)
                        with open(args.output, "w", newline="") as f:
                            writer = csv.writer(f)
                            writer.writerow(["prediction"])
                            for p in preds:
                                writer.writerow([p] if not isinstance(p, list) else p)
                        print(f"Predictions written to {{args.output}}")

                    else:
                        print("Provide --input or --values. See --help for details.")
                        sys.exit(1)


                if __name__ == "__main__":
                    main()
            """)
            requirements = textwrap.dedent("""\
                scikit-learn>=1.3
                numpy>=1.23
                xgboost>=2.0; extra == "xgboost"
                lightgbm>=4.0; extra == "lightgbm"
            """)

        readme = textwrap.dedent(f"""\
            # NeuralCanvas Inference Bundle
            **Pipeline:** {pipeline_name}
            **Algorithm:** {algorithm_name}
            **Features ({len(features)}):** {', '.join(str(f) for f in features) or 'see metadata'}

            ## Quick Start

            ```bash
            pip install -r requirements.txt

            # Predict from a CSV file
            python infer.py --input my_data.csv --output predictions.csv

            # Predict a single row (pass feature values in order)
            python infer.py --values 5.1 3.5 1.4 0.2

            # Classification: output class probabilities
            python infer.py --values 5.1 3.5 1.4 0.2 --proba
            ```

            ## Training Metrics
            ```json
            {metrics_repr}
            ```

            *Generated by [NeuralCanvas](https://github.com/NeuralCanvas) AI Studio*
        """)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(f"model.{model_ext}", model_bytes)
            zf.writestr("infer.py", infer_script)
            zf.writestr("requirements.txt", requirements)
            zf.writestr("README.md", readme)

        zip_buffer.seek(0)
        safe_name = pipeline_name.replace(" ", "_").lower()
        filename = f"{safe_name}_infer_bundle.zip"

        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = zip_buffer.getbuffer().nbytes
        return response