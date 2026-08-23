from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Pipeline, PipelineExecutionRun


class PipelineExecutionRunsView(APIView):
    """Lists execution history for a given pipeline."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        runs = PipelineExecutionRun.objects.filter(pipeline=pipeline)[:50]

        data = []
        for r in runs:
            data.append({
                "id": r.id,
                "run_number": r.run_number,
                "status": r.status,
                "start_time": r.start_time.strftime("%Y-%m-%d %H:%M:%S") if r.start_time else "",
                "end_time": r.end_time.strftime("%Y-%m-%d %H:%M:%S") if r.end_time else "",
                "elapsed_seconds": r.elapsed_seconds,
                "node_timings": r.node_timings or {},
                "nodes_count": len(r.nodes_snapshot) if r.nodes_snapshot else 0,
                "error": r.error,
            })
        return Response(data)


class ExecutionRunDetailView(APIView):
    """Retrieves full details of a specific execution run."""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, run_id):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        run = get_object_or_404(PipelineExecutionRun, id=run_id, pipeline=pipeline)

        return Response({
            "id": run.id,
            "run_number": run.run_number,
            "status": run.status,
            "start_time": run.start_time.strftime("%Y-%m-%d %H:%M:%S") if run.start_time else "",
            "end_time": run.end_time.strftime("%Y-%m-%d %H:%M:%S") if run.end_time else "",
            "elapsed_seconds": run.elapsed_seconds,
            "nodes_snapshot": run.nodes_snapshot,
            "node_outputs": run.node_outputs,
            "node_timings": run.node_timings,
            "error": run.error,
        })
