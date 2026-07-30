import os
import joblib
from django.conf import settings


class EvaluateExecutor:
    """Computes the chosen metric against the upstream trained model + test split."""

    def run(self, model, X_test, y_test, params: dict):
        metric = params["metric"]
        average = params.get("average", "binary")

        from sklearn import metrics as skm

        preds = model.predict(X_test)

        if metric == "accuracy":
            score = skm.accuracy_score(y_test, preds)
        elif metric == "precision":
            score = skm.precision_score(y_test, preds, average=average)
        elif metric == "recall":
            score = skm.recall_score(y_test, preds, average=average)
        elif metric == "f1":
            score = skm.f1_score(y_test, preds, average=average)
        elif metric == "rmse":
            score = skm.mean_squared_error(y_test, preds, squared=False)
        elif metric == "mae":
            score = skm.mean_absolute_error(y_test, preds)
        elif metric == "r2":
            score = skm.r2_score(y_test, preds)
        else:
            raise ValueError(f"Unsupported metric: {metric}")

        return {"metric": metric, "score": float(score)}


class SaveModelExecutor:
    """
    Persists a trained model to disk in the user-chosen format.

    - "pkl"           -> joblib.dump (sklearn / xgboost / classical ML)
    - "h5" / "keras"  -> model.save (Keras/TF — LSTM, CNN, ANN, GRU)

    Returns the saved path so it can be stored on NodeResult.model_path
    and served via DownloadModelView.
    """

    def run(self, model, pipeline_id: str, node_id: str, params: dict):
        fmt = params.get("format", "pkl")
        filename = params.get("filename", "model")

        out_dir = os.path.join(settings.MEDIA_ROOT, "models", str(pipeline_id))
        os.makedirs(out_dir, exist_ok=True)

        if fmt == "pkl":
            path = os.path.join(out_dir, f"{filename}.pkl")
            joblib.dump(model, path)

        elif fmt in ("h5", "keras"):
            ext = "h5" if fmt == "h5" else "keras"
            path = os.path.join(out_dir, f"{filename}.{ext}")
            # Keras models expose .save(); sklearn objects don't — this branch
            # only runs when the upstream node was a DL node (LSTM/CNN/ANN/GRU).
            model.save(path)

        else:
            raise ValueError(f"Unsupported save format: {fmt}")

        return {"model_path": path, "format": fmt}
