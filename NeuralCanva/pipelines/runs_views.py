import csv
import io
import json
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Pipeline, PipelineExecutionRun, Graph
from .task import execute_graph
from .views import _executor


class ExperimentRunsListView(APIView):
    """
    Comprehensive Experiment Tracking API:
    Supports searching, algorithm filtering, status filtering, metrics sorting,
    best-run analysis, and pagination.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk=None):
        queryset = PipelineExecutionRun.objects.filter(
            Q(pipeline__owner=request.user) | Q(owner=request.user),
            is_archived=False
        ).select_related('pipeline')

        if pk is not None:
            pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
            queryset = queryset.filter(pipeline=pipeline)

        # Filters
        algo_filter = request.GET.get('algorithm')
        if algo_filter:
            queryset = queryset.filter(algorithm__icontains=algo_filter)

        status_filter = request.GET.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search_query = request.GET.get('q', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(algorithm__icontains=search_query) |
                Q(dataset_name__icontains=search_query) |
                Q(pipeline__name__icontains=search_query)
            )

        runs = list(queryset[:100])

        # Find best run (highest accuracy or highest R2)
        best_run_id = None
        best_score = -1.0
        for r in runs:
            m = r.metrics or {}
            score = float(m.get('accuracy', m.get('r2', -1.0)))
            if score > best_score:
                best_score = score
                best_run_id = r.id

        data = []
        for r in runs:
            data.append({
                "id": r.id,
                "pipeline_id": r.pipeline_id,
                "pipeline_name": r.pipeline.name if r.pipeline else "Unknown",
                "pipeline_version": r.pipeline_version,
                "run_number": r.run_number,
                "status": r.status,
                "dataset_name": r.dataset_name or (r.pipeline.name if r.pipeline else ""),
                "dataset_fingerprint": r.dataset_fingerprint,
                "algorithm": r.algorithm or "Standard ML",
                "hyperparameters": r.hyperparameters or {},
                "preprocessing_steps": r.preprocessing_steps or [],
                "metrics": r.metrics or {},
                "random_seed": r.random_seed,
                "is_best_run": (r.id == best_run_id and best_score >= 0),
                "start_time": r.start_time.strftime("%Y-%m-%d %H:%M:%S") if r.start_time else "",
                "end_time": r.end_time.strftime("%Y-%m-%d %H:%M:%S") if r.end_time else "",
                "elapsed_seconds": r.elapsed_seconds,
                "node_timings": r.node_timings or {},
                "nodes_count": len(r.nodes_snapshot) if r.nodes_snapshot else 0,
                "error": r.error,
            })

        # Sorting
        sort_by = request.GET.get('sort', 'start_time')
        order = request.GET.get('order', 'desc')
        reverse = (order.lower() == 'desc')

        if sort_by in ('accuracy', 'f1', 'precision', 'recall', 'r2', 'rmse', 'mse'):
            data.sort(key=lambda x: float(x.get('metrics', {}).get(sort_by, 0.0) or 0.0), reverse=reverse)
        elif sort_by == 'elapsed_seconds':
            data.sort(key=lambda x: float(x.get('elapsed_seconds') or 0.0), reverse=reverse)
        elif sort_by == 'run_number':
            data.sort(key=lambda x: int(x.get('run_number') or 0), reverse=reverse)

        return Response({
            "total_runs": len(data),
            "best_run_id": best_run_id,
            "runs": data
        })


class ExecutionRunDetailView(APIView):
    """Retrieves full details, reruns, or archives a specific execution run."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_run(self, run_id, user):
        return get_object_or_404(
            PipelineExecutionRun,
            id=run_id,
            pipeline__owner=user
        )

    def get(self, request, pk=None, run_id=None):
        actual_id = run_id if run_id else pk
        run = self.get_run(actual_id, request.user)

        return Response({
            "id": run.id,
            "pipeline_id": run.pipeline_id,
            "pipeline_name": run.pipeline.name if run.pipeline else "",
            "run_number": run.run_number,
            "pipeline_version": run.pipeline_version,
            "status": run.status,
            "dataset_name": run.dataset_name,
            "dataset_fingerprint": run.dataset_fingerprint,
            "algorithm": run.algorithm,
            "hyperparameters": run.hyperparameters,
            "preprocessing_steps": run.preprocessing_steps,
            "metrics": run.metrics,
            "random_seed": run.random_seed,
            "start_time": run.start_time.strftime("%Y-%m-%d %H:%M:%S") if run.start_time else "",
            "end_time": run.end_time.strftime("%Y-%m-%d %H:%M:%S") if run.end_time else "",
            "elapsed_seconds": run.elapsed_seconds,
            "nodes_snapshot": run.nodes_snapshot,
            "node_outputs": run.node_outputs,
            "node_timings": run.node_timings,
            "error": run.error,
        })

    def delete(self, request, pk=None, run_id=None):
        actual_id = run_id if run_id else pk
        run = self.get_run(actual_id, request.user)
        run.is_archived = True
        run.save(update_fields=['is_archived'])
        return Response({"message": f"Experiment run #{run.run_number} archived successfully."})


class ExperimentRerunView(APIView):
    """Reruns a historic experiment execution run snapshot."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, run_id):
        run = get_object_or_404(PipelineExecutionRun, id=run_id, pipeline__owner=request.user)
        graph, _ = Graph.objects.get_or_create(pipeline=run.pipeline)

        if run.nodes_snapshot:
            graph.nodes = run.nodes_snapshot
            graph.status = 'running'
            graph.error = ''
            graph.save(update_fields=['nodes', 'status', 'error'])

        _executor.submit(execute_graph, graph.id)
        return Response({
            "message": f"Rerunning experiment #{run.run_number} for pipeline '{run.pipeline.name}'",
            "pipeline_id": run.pipeline_id,
            "graph_id": graph.id,
            "status": "running"
        })


class ExportExperimentsView(APIView):
    """Exports all user experiment runs as downloadable CSV or JSON."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def perform_content_negotiation(self, request, force=False):
        return super().perform_content_negotiation(request, force=True)

    def get(self, request, pk=None):
        queryset = PipelineExecutionRun.objects.filter(
            Q(pipeline__owner=request.user) | Q(owner=request.user),
            is_archived=False
        ).select_related('pipeline')

        if pk is not None:
            pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
            queryset = queryset.filter(pipeline=pipeline)

        export_format = request.GET.get('format', 'json').lower()

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="experiments_report.csv"'
            writer = csv.writer(response)
            writer.writerow([
                'Run ID', 'Pipeline', 'Run Number', 'Algorithm', 'Status',
                'Dataset', 'Accuracy', 'F1 Score', 'R2 Score', 'RMSE',
                'Duration (s)', 'Start Time'
            ])
            for r in queryset:
                m = r.metrics or {}
                writer.writerow([
                    r.id,
                    r.pipeline.name if r.pipeline else "",
                    r.run_number,
                    r.algorithm,
                    r.status,
                    r.dataset_name,
                    m.get('accuracy', ''),
                    m.get('f1', ''),
                    m.get('r2', ''),
                    m.get('rmse', ''),
                    r.elapsed_seconds,
                    r.start_time.strftime("%Y-%m-%d %H:%M:%S") if r.start_time else ""
                ])
            return response

        # Default JSON
        records = []
        for r in queryset:
            records.append({
                "id": r.id,
                "pipeline": r.pipeline.name if r.pipeline else "",
                "run_number": r.run_number,
                "algorithm": r.algorithm,
                "status": r.status,
                "dataset_name": r.dataset_name,
                "dataset_fingerprint": r.dataset_fingerprint,
                "hyperparameters": r.hyperparameters,
                "preprocessing_steps": r.preprocessing_steps,
                "metrics": r.metrics,
                "duration_seconds": r.elapsed_seconds,
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "error": r.error
            })
        return Response(records)


# Alias for legacy compatibility
PipelineExecutionRunsView = ExperimentRunsListView
