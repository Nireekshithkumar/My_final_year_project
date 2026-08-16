import pandas as pd
import numpy as np
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Graph


class DatasetPreviewView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, node_id=None):
        try:
            graph = Graph.objects.get(pipeline_id=pk, pipeline__owner=request.user)
        except Graph.DoesNotExist:
            return JsonResponse({"detail": "Pipeline graph not found."}, status=404)

        node_outputs = graph.node_outputs or {}
        target_node_id = node_id
        if not target_node_id or target_node_id == 'latest':
            target_node_id = list(node_outputs.keys())[-1] if node_outputs else None

        output_data = node_outputs.get(target_node_id) if target_node_id else None

        # If no output cached yet, check if this is a loadDataset node that we can read directly
        if not output_data:
            nodes = graph.nodes or []
            target_node = next((n for n in nodes if isinstance(n, dict) and str(n.get('id')) == str(target_node_id)), None)
            if target_node:
                t_data = target_node.get('data', {})
                if t_data.get('nodeType') == 'loadDataset' and t_data.get('datasetId'):
                    from datasets.models import Dataset
                    import os
                    try:
                        ds = Dataset.objects.get(id=t_data['datasetId'])
                        if ds.file and os.path.exists(ds.file.path):
                            loaded_df = pd.read_csv(ds.file.path)
                            output_data = {
                                "dataframe": loaded_df.to_dict(orient='list'),
                                "columns": list(loaded_df.columns),
                                "column_types": ds.column_types or {}
                            }
                    except Exception:
                        pass

        if not output_data:
            if not target_node_id or target_node_id == 'latest':
                return JsonResponse({"detail": "No node output cached yet. Run the pipeline or node first."}, status=404)
            return JsonResponse({"detail": f"No output found for node '{target_node_id}'. Run the block or pipeline first."}, status=404)

        # Build DataFrame from cached output structure
        df = None
        if "dataframe" in output_data:
            df = pd.DataFrame(output_data["dataframe"])

        elif "X_train" in output_data and "X_test" in output_data:
            # Split-format output — show train + test combined, labelled
            cols = output_data.get("columns", [f"feat_{i}" for i in range(len(output_data["X_train"][0]) if output_data["X_train"] else 0)])
            train_df = pd.DataFrame(output_data["X_train"], columns=cols)
            train_df["_split"] = "train"
            if output_data.get("y_train"):
                train_df["target"] = output_data["y_train"]

            test_df = pd.DataFrame(output_data["X_test"], columns=cols)
            test_df["_split"] = "test"
            if output_data.get("y_test"):
                test_df["target"] = output_data["y_test"]

            df = pd.concat([train_df, test_df], ignore_index=True)

        elif "X" in output_data:
            cols = output_data.get("columns", [f"feat_{i}" for i in range(len(output_data["X"][0]) if output_data["X"] else 0)])
            df = pd.DataFrame(output_data["X"], columns=cols)
            if "y" in output_data and output_data["y"]:
                df["target"] = output_data["y"]

        elif "transformed" in output_data:
            cols = [f"component_{i+1}" for i in range(len(output_data["transformed"][0]) if output_data["transformed"] else 0)]
            df = pd.DataFrame(output_data["transformed"], columns=cols)

        elif "predictions" in output_data:
            preds = output_data.get("predictions", [])
            actual = output_data.get("actual", output_data.get("y_test", []))
            # Guard: truncate to the shorter of the two to avoid length mismatch
            min_len = min(len(preds), len(actual)) if actual else len(preds)
            row_data = {"predictions": preds[:min_len]}
            if actual:
                row_data["actual"] = actual[:min_len]
            df = pd.DataFrame(row_data)

        # Pagination params
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))

        if df is None or df.empty:
            # Check for non-tabular metric / artifact outputs
            has_artifacts = any(k in output_data for k in [
                "metrics", "plots", "confusion_matrix", "classification_report",
                "accuracy", "f1", "precision", "recall", "r2", "rmse", "mse", "mae",
                "null_summary", "histogram", "boxplot", "correlation_matrix", "explained_variance_ratio"
            ])
            if has_artifacts:
                response_data = {
                    "node_id": target_node_id,
                    "page": page,
                    "page_size": page_size,
                    "total_rows": 0,
                    "total_columns": 0,
                    "columns": [],
                    "column_types": {},
                    "column_stats": {},
                    "rows": [],
                }
                for key in [
                    "metrics", "plots", "confusion_matrix", "classification_report",
                    "accuracy", "f1", "precision", "recall", "r2", "rmse", "mse", "mae",
                    "null_summary", "histogram", "boxplot", "correlation_matrix", "explained_variance_ratio"
                ]:
                    if key in output_data:
                        response_data[key] = output_data[key]
                return JsonResponse(response_data)

            return JsonResponse({"detail": "Node output does not contain previewable tabular data."}, status=400)

        total_rows = len(df)
        total_columns = len(df.columns)

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        sliced_df = df.iloc[start_idx:end_idx]

        # Compute column statistics & detect types
        column_stats = {}
        column_types = {}

        for col in df.columns:
            series = df[col]
            null_count = int(series.isnull().sum())
            non_null = series.dropna()

            if pd.api.types.is_numeric_dtype(series):
                col_type = "numerical"
                if len(non_null) > 0:
                    stats = {
                        "mean": round(float(non_null.mean()), 4),
                        "median": round(float(non_null.median()), 4),
                        "min": round(float(non_null.min()), 4),
                        "max": round(float(non_null.max()), 4),
                        "std": round(float(non_null.std()), 4) if len(non_null) > 1 else 0.0,
                        "q25": round(float(non_null.quantile(0.25)), 4),
                        "q75": round(float(non_null.quantile(0.75)), 4),
                        "null_count": null_count,
                    }
                else:
                    stats = {"null_count": null_count}
            elif pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
                sample_str = str(non_null.iloc[0]) if len(non_null) > 0 else ""
                avg_len = float(non_null.astype(str).str.len().mean()) if len(non_null) > 0 else 0
                if avg_len > 30:
                    col_type = "text"
                    lens = non_null.astype(str).str.len()
                    stats = {
                        "avg_len": round(avg_len, 1),
                        "min_len": int(lens.min()) if len(lens) > 0 else 0,
                        "max_len": int(lens.max()) if len(lens) > 0 else 0,
                        "null_count": null_count,
                    }
                else:
                    col_type = "categorical"
                    top_val = str(non_null.mode()[0]) if len(non_null) > 0 else "N/A"
                    top_freq = int((non_null == top_val).sum()) if len(non_null) > 0 else 0
                    stats = {
                        "unique_count": int(series.nunique()),
                        "top_value": top_val,
                        "top_freq": top_freq,
                        "null_count": null_count,
                    }
            elif pd.api.types.is_bool_dtype(series):
                col_type = "boolean"
                stats = {"unique_count": int(series.nunique()), "null_count": null_count}
            else:
                col_type = "categorical"
                stats = {"unique_count": int(series.nunique()), "null_count": null_count}

            column_types[col] = col_type
            column_stats[col] = stats

        rows = sliced_df.to_dict(orient='records')

        response_data = {
            "node_id": target_node_id,
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_columns": total_columns,
            "columns": list(df.columns),
            "column_types": column_types,
            "column_stats": column_stats,
            "rows": rows,
        }

        # Forward any rich model / EDA / evaluation artifacts
        for key in [
            "metrics", "plots", "confusion_matrix", "classification_report",
            "accuracy", "f1", "precision", "recall", "r2", "rmse", "mse", "mae",
            "null_summary", "histogram", "boxplot", "correlation_matrix", "explained_variance_ratio"
        ]:
            if key in output_data:
                response_data[key] = output_data[key]

        return JsonResponse(response_data)
