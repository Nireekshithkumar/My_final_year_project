from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Pipeline, Graph
from .serializer import PipelineSerializer, GraphSerializer
from .task import execute_graph
from .cache import invalidate_graph_cache



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
        graph = get_object_or_404(Graph, pipeline=pipeline)

        graph.status = 'running'
        graph.save()

        execute_graph.delay(graph.id)  # fire async

        return Response({'message': 'Execution started', 'graph_id': graph.id})


class GraphStopView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        pipeline = get_object_or_404(Pipeline, pk=pk, owner=request.user)
        graph = get_object_or_404(Graph, pipeline=pipeline)

        action = request.data.get('action', 'pause')
        new_status = 'paused' if action == 'pause' else 'idle'

        graph.status = new_status
        graph.save()

        from .task import broadcast
        broadcast(graph.pipeline_id, f"Execution {new_status} by user.", stage=new_status, percent=None)

        return Response({'message': f'Execution {new_status}', 'graph_id': graph.id, 'status': new_status})
