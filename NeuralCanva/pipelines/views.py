from concurrent.futures import ThreadPoolExecutor
import logging
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from .models import Pipeline, Graph
from .serializer import PipelineSerializer, GraphSerializer
from .task import execute_graph, broadcast
from .cache import invalidate_graph_cache

logger = logging.getLogger(__name__)

# Module-level executor — shared across requests so threads are reused and bounded.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pipeline_worker")


class PipelineListCreateView(generics.ListCreateAPIView):
    serializer_class = PipelineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Pipeline.objects.filter(owner=self.request.user).select_related('graph')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PipelineDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PipelineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Pipeline.objects.filter(owner=self.request.user)


class GraphUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_pipeline(self, pk, user):
        return get_object_or_404(Pipeline, pk=pk, owner=user)

    def get(self, request, pk):
        pipeline = self.get_pipeline(pk, request.user)
        graph, _ = Graph.objects.get_or_create(pipeline=pipeline)
        return Response(GraphSerializer(graph).data)

    def put(self, request, pk):
        pipeline = self.get_pipeline(pk, request.user)
        graph, _ = Graph.objects.get_or_create(pipeline=pipeline)

        # invalidate old cache before saving new graph
        invalidate_graph_cache(request.user.id, graph.nodes, graph.edges)

        serializer = GraphSerializer(graph, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class GraphExecuteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        graph, _ = Graph.objects.get_or_create(pipeline=pipeline)

        # Atomic check-and-set to prevent race conditions on simultaneous execute requests
        with transaction.atomic():
            graph = Graph.objects.select_for_update().get(id=graph.id)
            if graph.status == 'running':
                # Safe stale-running recovery: If execution has exceeded a reasonable timeout (e.g. 180s)
                # or user explicitly provided force flag, recover from deadlocked/crashed state.
                from django.utils import timezone
                is_stale = False
                if graph.updated_at:
                    elapsed_since_update = (timezone.now() - graph.updated_at).total_seconds()
                    if elapsed_since_update > 180:
                        is_stale = True
                
                force_rerun = request.data.get('force', False) if isinstance(request.data, dict) else False

                if is_stale or force_rerun:
                    logger.warning(f"Recovering stale running graph {graph.id} (last updated {elapsed_since_update if graph.updated_at else 'unknown'}s ago).")
                    graph.status = 'failed'
                    graph.error = "Previous execution terminated unexpectedly or timed out. State recovered."
                    graph.save(update_fields=['status', 'error', 'updated_at'])
                else:
                    return Response(
                        {
                            'message': 'Pipeline is already running.',
                            'graph_id': graph.id,
                            'status': 'running',
                        },
                        status=409,
                    )

            graph.status = 'running'
            graph.error = ''
            graph.save(update_fields=['status', 'error'])

        # Submit to controlled thread pool — returns immediately without blocking Daphne
        _executor.submit(execute_graph, graph.id)

        return Response({
            'message': 'Execution started',
            'graph_id': graph.id,
            'status': 'running',
        })


class GraphStopView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        graph = get_object_or_404(Graph, pipeline=pipeline)

        action = request.data.get('action', 'pause')
        new_status = 'paused' if action == 'pause' else 'idle'

        graph.status = new_status
        graph.save(update_fields=['status'])

        broadcast(
            graph.pipeline_id,
            f"Execution {new_status} by user.",
            stage=new_status,
            percent=None,
        )

        return Response({
            'message': f'Execution {new_status}',
            'graph_id': graph.id,
            'status': new_status,
        })