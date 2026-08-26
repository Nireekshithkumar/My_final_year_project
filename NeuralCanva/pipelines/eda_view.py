"""
EDA (Exploratory Data Analysis) Profile Generator
===================================================
GET /api/pipelines/<pk>/eda/          → full profile for the dataset attached to this pipeline
GET /api/pipelines/<pk>/eda/?node=<id> → profile from a specific node's output dataframe

Returns JSON with:
  - summary        : row/col counts, missing total, duplicate count
  - columns        : per-column stats (type, missing, unique, mean/std/min/max, top-freq)
  - correlation    : Pearson correlation matrix for numeric columns
  - histograms     : bin counts for up to MAX_HIST_COLS numeric columns
  - outliers       : IQR-based outlier counts per numeric column
  - sample         : first SAMPLE_ROWS rows as list-of-dicts
"""

import json
import math
import logging
import numpy as np
import pandas as pd

from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from common.storage import StorageAbstraction
from .models import Graph

logger = logging.getLogger(__name__)

MAX_HIST_COLS = 20      # max numeric columns for histogram computation
MAX_CORR_COLS = 30      # max numeric columns for correlation matrix
SAMPLE_ROWS = 10        # rows returned in sample preview
HIST_BINS = 20          # bins per histogram


def _safe_val(v):
    """Convert numpy/pandas scalars to JSON-serialisable Python types."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def _profile_dataframe(df: pd.DataFrame) -> dict:
    """Compute full EDA profile from a DataFrame."""
    n_rows, n_cols = df.shape
    n_missing_total = int(df.isnull().sum().sum())
    n_duplicates = int(df.duplicated().sum())

    columns = []
    numeric_cols = []

    for col in df.columns:
        series = df[col]
        n_missing = int(series.isnull().sum())
        n_unique = int(series.nunique(dropna=True))
        dtype_str = str(series.dtype)

        col_info: dict = {
            "name": col,
            "dtype": dtype_str,
            "missing": n_missing,
            "missing_pct": round(n_missing / n_rows * 100, 2) if n_rows else 0,
            "unique": n_unique,
            "unique_pct": round(n_unique / n_rows * 100, 2) if n_rows else 0,
        }

        if pd.api.types.is_numeric_dtype(series):
            col_info["kind"] = "numeric"
            numeric_cols.append(col)
            valid = series.dropna()
            col_info.update({
                "mean":   _safe_val(valid.mean()),
                "std":    _safe_val(valid.std()),
                "min":    _safe_val(valid.min()),
                "max":    _safe_val(valid.max()),
                "p25":    _safe_val(valid.quantile(0.25)),
                "median": _safe_val(valid.quantile(0.50)),
                "p75":    _safe_val(valid.quantile(0.75)),
                "zeros":  int((valid == 0).sum()),
                "negatives": int((valid < 0).sum()),
            })
            # IQR outlier count
            q1, q3 = valid.quantile(0.25), valid.quantile(0.75)
            iqr = q3 - q1
            col_info["outlier_count"] = int(((valid < (q1 - 1.5 * iqr)) | (valid > (q3 + 1.5 * iqr))).sum())

        elif pd.api.types.is_datetime64_any_dtype(series):
            col_info["kind"] = "datetime"
            valid = series.dropna()
            col_info["min"] = str(valid.min()) if len(valid) else None
            col_info["max"] = str(valid.max()) if len(valid) else None

        else:
            col_info["kind"] = "categorical"
            vc = series.value_counts(dropna=True)
            col_info["top_values"] = [
                {"value": str(k), "count": int(v)}
                for k, v in vc.head(5).items()
            ]

        columns.append(col_info)

    # --- Correlation matrix (numeric only, cap at MAX_CORR_COLS) ---
    corr_data = {}
    num_df = df[numeric_cols[:MAX_CORR_COLS]].select_dtypes(include=[np.number])
    if len(num_df.columns) > 1:
        try:
            corr_matrix = num_df.corr()
            corr_data = {
                "columns": list(corr_matrix.columns),
                "matrix": [
                    [_safe_val(v) for v in row]
                    for row in corr_matrix.values.tolist()
                ],
            }
        except Exception:
            pass

    # --- Histograms (numeric only, cap at MAX_HIST_COLS) ---
    histograms = {}
    for col in numeric_cols[:MAX_HIST_COLS]:
        try:
            valid = df[col].dropna()
            if len(valid) < 2:
                continue
            counts, edges = np.histogram(valid, bins=HIST_BINS)
            histograms[col] = {
                "bins": [_safe_val(e) for e in edges.tolist()],
                "counts": [int(c) for c in counts.tolist()],
            }
        except Exception:
            pass

    # --- Sample rows ---
    try:
        sample = json.loads(df.head(SAMPLE_ROWS).to_json(orient="records", date_format="iso"))
    except Exception:
        sample = []

    return {
        "summary": {
            "rows": n_rows,
            "columns": n_cols,
            "numeric_columns": len(numeric_cols),
            "missing_total": n_missing_total,
            "missing_pct": round(n_missing_total / (n_rows * n_cols) * 100, 2) if n_rows * n_cols else 0,
            "duplicates": n_duplicates,
        },
        "columns": columns,
        "correlation": corr_data,
        "histograms": histograms,
        "sample": sample,
    }


def _df_from_node_output(output: dict) -> pd.DataFrame | None:
    """Reconstruct a DataFrame from a node_output entry."""
    if not isinstance(output, dict):
        return None
    if "dataframe" in output and isinstance(output["dataframe"], dict):
        try:
            return pd.DataFrame(output["dataframe"])
        except Exception:
            pass
    if "data" in output and isinstance(output["data"], list):
        try:
            return pd.DataFrame(output["data"])
        except Exception:
            pass
    return None


class EDAProfileView(APIView):
    """
    Automated EDA & Data Profiling endpoint.

    Resolves the dataset for this pipeline (loadDataset node → Dataset file,
    or any node output that contains a 'dataframe' key) and computes a
    comprehensive statistical profile without requiring any extra packages.

    Query params:
        node=<node_id>  — profile a specific node's output (default: loadDataset node)

    Response shape:
        {
            summary: { rows, columns, numeric_columns, missing_total, missing_pct, duplicates },
            columns: [ { name, dtype, kind, missing, unique, mean, std, ... }, ... ],
            correlation: { columns: [...], matrix: [[...], ...] },
            histograms: { col: { bins: [...], counts: [...] }, ... },
            sample: [ { col: val, ... }, ... ]
        }
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            graph = Graph.objects.select_related("pipeline").get(
                pipeline_id=pk, pipeline__owner=request.user
            )
        except Graph.DoesNotExist:
            return JsonResponse({"detail": "Pipeline graph not found."}, status=404)

        node_id = request.GET.get("node")
        df = None

        # 1. Try a specific node's output
        if node_id:
            node_output = (graph.node_outputs or {}).get(node_id)
            df = _df_from_node_output(node_output)
            if df is None:
                return JsonResponse(
                    {"detail": f"Node '{node_id}' has no dataframe output cached. Run the pipeline first."},
                    status=404,
                )

        # 2. Try loadDataset node → read from file
        if df is None:
            nodes = graph.nodes or []
            dataset_node = next(
                (n for n in nodes if isinstance(n, dict) and n.get("data", {}).get("nodeType") == "loadDataset"),
                None,
            )
            if dataset_node:
                dataset_id = dataset_node.get("data", {}).get("datasetId")
                if dataset_id:
                    try:
                        from datasets.models import Dataset
                        ds = Dataset.objects.get(id=dataset_id)
                        df = StorageAbstraction.read_dataset_df(ds)
                    except Exception as exc:
                        logger.warning(f"EDA: failed to read dataset {dataset_id}: {exc}")

        # 3. Fall back: search all node_outputs for a dataframe
        if df is None:
            for out in (graph.node_outputs or {}).values():
                candidate = _df_from_node_output(out)
                if candidate is not None and not candidate.empty:
                    df = candidate
                    break

        if df is None:
            return JsonResponse(
                {
                    "detail": (
                        "No dataset found for this pipeline. "
                        "Add a 'Load Dataset' node and run the pipeline first, "
                        "or pass ?node=<node_id> to profile a specific node's output."
                    )
                },
                status=404,
            )

        # Compute profile
        try:
            profile = _profile_dataframe(df)
        except Exception as exc:
            logger.exception("EDA profiling failed")
            return JsonResponse({"detail": f"EDA profiling error: {exc}"}, status=500)

        return JsonResponse(profile)
