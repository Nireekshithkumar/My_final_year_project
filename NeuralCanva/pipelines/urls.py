from django.urls import path
from .views import PipelineListCreateView, PipelineDetailView, GraphUpdateView, GraphExecuteView, GraphStopView
from .download import DownloadModelBundleView
from .predict_view import PredictView
from .node_run_view import NodeRunView
from .dataset_preview_view import DatasetPreviewView

urlpatterns = [
    path('', PipelineListCreateView.as_view(), name='pipeline-list-create'),
    path('<int:pk>/', PipelineDetailView.as_view(), name='pipeline-detail'),
    path('<int:pk>/graph/', GraphUpdateView.as_view(), name='graph-update'),
    path('<int:pk>/execute/', GraphExecuteView.as_view(), name='graph-execute'),
    path('<int:pk>/stop/', GraphStopView.as_view(), name='graph-stop'),
    path('<int:pk>/download/', DownloadModelBundleView.as_view(), name='download-bundle'),
    path('<int:pk>/predict/', PredictView.as_view(), name='predict'),
    path('<int:pk>/nodes/<str:node_id>/run/', NodeRunView.as_view(), name='node-run'),
    path('<int:pk>/nodes/<str:node_id>/preview/', DatasetPreviewView.as_view(), name='dataset-node-preview'),
    path('<int:pk>/nodes/preview/', DatasetPreviewView.as_view(), name='dataset-latest-preview'),
]


