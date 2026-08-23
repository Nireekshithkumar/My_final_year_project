from django.urls import path
from .views import (
    StatusAPIView,
    ContextAPIView,
    ChatAPIView,
    AnalyzeDatasetAPIView,
    RecommendModelAPIView,
    GeneratePipelineAPIView,
    DebugPipelineAPIView,
    ExplainNodeAPIView,
    OptimizePipelineAPIView,
    ApplyActionAPIView,
)

urlpatterns = [
    path('status/', StatusAPIView.as_view(), name='ai-status'),
    path('context/', ContextAPIView.as_view(), name='ai-context'),
    path('chat/', ChatAPIView.as_view(), name='ai-chat'),
    path('analyze-dataset/', AnalyzeDatasetAPIView.as_view(), name='ai-analyze-dataset'),
    path('recommend-model/', RecommendModelAPIView.as_view(), name='ai-recommend-model'),
    path('generate-pipeline/', GeneratePipelineAPIView.as_view(), name='ai-generate-pipeline'),
    path('debug-pipeline/', DebugPipelineAPIView.as_view(), name='ai-debug-pipeline'),
    path('explain-node/', ExplainNodeAPIView.as_view(), name='ai-explain-node'),
    path('optimize-pipeline/', OptimizePipelineAPIView.as_view(), name='ai-optimize-pipeline'),
    path('apply-action/', ApplyActionAPIView.as_view(), name='ai-apply-action'),
]
