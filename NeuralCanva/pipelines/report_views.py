import json
import logging
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Pipeline, Graph, TrainedModel

logger = logging.getLogger(__name__)


class GenerateMLReportView(APIView):
    """
    Generates a ML report for a pipeline run.
    Supports ?format=json and ?format=html.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        graph = get_object_or_404(Graph, pipeline=pipeline)
        report_format = request.GET.get('format', 'html').lower()

        nodes = graph.nodes or []
        edges = graph.edges or []
        node_outputs = graph.node_outputs or {}

        # Extract dataset info
        dataset_node = next((n for n in nodes if n.get('data', {}).get('nodeType') == 'loadDataset'), None)
        dataset_name = dataset_node.get('data', {}).get('title', 'Unknown') if dataset_node else 'N/A'

        # Extract preprocessing blocks
        preprocessing_blocks = [
            n.get('data', {}).get('title', n.get('data', {}).get('nodeType'))
            for n in nodes if n.get('data', {}).get('nodeType') in ('splitDataset', 'Encoder', 'StandardScaler', 'MinMaxScaler', 'RobustScaler', 'Imputer', 'FeatureSelector')
        ]

        # Extract model and metrics
        model_node = next((n for n in nodes if n.get('data', {}).get('nodeType') not in ('start', 'end', 'loadDataset', 'splitDataset', 'Encoder', 'StandardScaler', 'MinMaxScaler', 'RobustScaler', 'Histogram', 'Boxplot', 'Correlation', 'DescribeStats', 'predict', 'evaluate')), None)
        algo_name = model_node.get('data', {}).get('title', 'Model') if model_node else 'N/A'
        params = model_node.get('data', {}).get('params', {}) if model_node else {}

        # Aggregate metrics from node outputs or graph.result
        metrics = {}
        for out in node_outputs.values():
            if isinstance(out, dict):
                if 'metrics' in out:
                    metrics.update(out['metrics'])
                elif 'accuracy' in out:
                    metrics['accuracy'] = out['accuracy']
                    metrics['f1'] = out.get('f1')
                    metrics['precision'] = out.get('precision')
                    metrics['recall'] = out.get('recall')
                elif 'r2' in out:
                    metrics['r2'] = out['r2']
                    metrics['rmse'] = out.get('rmse')
                    metrics['mse'] = out.get('mse')

        report_data = {
            "title": f"Machine Learning Execution Report: {pipeline.name}",
            "pipeline_id": pipeline.id,
            "pipeline_name": pipeline.name,
            "owner": request.user.username,
            "execution_status": graph.status,
            "elapsed_seconds": graph.elapsed_seconds,
            "dataset": dataset_name,
            "preprocessing_steps": preprocessing_blocks,
            "algorithm": algo_name,
            "hyperparameters": params,
            "metrics": metrics,
            "nodes_count": len(nodes),
            "generated_at": graph.updated_at.strftime("%Y-%m-%d %H:%M:%S") if graph.updated_at else "",
        }

        if report_format == 'json':
            return JsonResponse(report_data)

        # Generate HTML report
        metrics_html = "".join([f"<tr><td style='padding:8px 12px;border:1px solid #334155;font-weight:600;'>{k.upper()}</td><td style='padding:8px 12px;border:1px solid #334155;color:#ff85be;font-weight:700;'>{v}</td></tr>" for k, v in metrics.items() if not isinstance(v, (dict, list))])
        params_html = "".join([f"<tr><td style='padding:6px 12px;border:1px solid #334155;'>{k}</td><td style='padding:6px 12px;border:1px solid #334155;color:#93c5fd;'>{v}</td></tr>" for k, v in params.items()])
        prep_html = "".join([f"<li style='margin-bottom:6px;'>{p}</li>" for p in preprocessing_blocks]) if preprocessing_blocks else "<li>None (Raw Features)</li>"

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>NeuralCanvas ML Report - {pipeline.name}</title>
    <style>
        body {{ font-family: 'Segoe UI', system-ui, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 40px 20px; line-height: 1.6; margin: 0; }}
        .container {{ max-width: 850px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 36px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }}
        .header {{ border-bottom: 2px solid #ff0071; padding-bottom: 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; }}
        h1 {{ color: #f8fafc; margin: 0; font-size: 24px; }}
        h2 {{ color: #ff85be; font-size: 16px; margin-top: 24px; margin-bottom: 12px; border-left: 4px solid #ff0071; padding-left: 10px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        .badge {{ background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; }}
        .print-btn {{ background: linear-gradient(135deg, #ff0071, #d90368); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }}
        @media print {{ .print-btn {{ display: none; }} body {{ background: #fff; color: #000; }} .container {{ border: none; box-shadow: none; padding: 0; }} }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>⚡ NeuralCanvas ML Execution Report</h1>
                <div style="color: #64748b; font-size: 13px; margin-top: 4px;">Pipeline: <strong>{pipeline.name}</strong> (ID: #{pipeline.id})</div>
            </div>
            <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px;">
            <div style="background:#1f2937;padding:14px;border-radius:10px;">
                <div style="font-size:11px;color:#94a3b8;font-weight:700;">STATUS</div>
                <div style="font-size:18px;font-weight:800;color:#86efac;margin-top:4px;">{graph.status.upper()}</div>
            </div>
            <div style="background:#1f2937;padding:14px;border-radius:10px;">
                <div style="font-size:11px;color:#94a3b8;font-weight:700;">DURATION</div>
                <div style="font-size:18px;font-weight:800;color:#93c5fd;margin-top:4px;">{graph.elapsed_seconds or '0'}s</div>
            </div>
            <div style="background:#1f2937;padding:14px;border-radius:10px;">
                <div style="font-size:11px;color:#94a3b8;font-weight:700;">ALGORITHM</div>
                <div style="font-size:18px;font-weight:800;color:#ff85be;margin-top:4px;">{algo_name}</div>
            </div>
        </div>

        <h2>1. Evaluation Metrics</h2>
        <table>
            <tbody>
                {metrics_html or "<tr><td colspan='2' style='padding:8px 12px;color:#64748b;'>No metrics generated yet. Run the pipeline first.</td></tr>"}
            </tbody>
        </table>

        <h2>2. Data & Preprocessing Pipeline</h2>
        <div style="background:#1f2937;padding:16px;border-radius:10px;margin-top:10px;">
            <div><strong>Dataset:</strong> {dataset_name}</div>
            <div style="margin-top:10px;"><strong>Preprocessing Sequence:</strong></div>
            <ul style="padding-left:20px;margin-top:6px;color:#cbd5e1;">
                {prep_html}
            </ul>
        </div>

        <h2>3. Algorithm Configuration</h2>
        <table>
            <tbody>
                {params_html or "<tr><td colspan='2' style='padding:8px 12px;color:#64748b;'>Default hyperparameters used.</td></tr>"}
            </tbody>
        </table>

        <div style="margin-top:36px;border-top:1px solid #1f2937;padding-top:14px;color:#64748b;font-size:12px;display:flex;justify-content:space-between;">
            <div>Generated by NeuralCanvas AI Studio</div>
            <div>{report_data['generated_at']}</div>
        </div>
    </div>
</body>
</html>
"""
        return HttpResponse(html_content, content_type='text/html')
