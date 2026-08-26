from django.urls import path
from .views import (
    PipelineListCreateView,
    PipelineDetailView,
    GraphUpdateView,
    GraphExecuteView,
    GraphStopView,
    PipelineValidateView,
)
from .download import DownloadModelBundleView, DownloadONNXView, DownloadInferScriptView
from .predict_view import PredictView
from .node_run_view import NodeRunView
from .dataset_preview_view import DatasetPreviewView
from .registry_views import ModelRegistryListView, ModelRegistryDetailView
from .predict_api import RegisteredModelPredictView
from .runs_views import (
    PipelineExecutionRunsView,
    ExperimentRunsListView,
    ExecutionRunDetailView,
    ExperimentRerunView,
    ExportExperimentsView,
)
from .report_views import GenerateMLReportView
from .export_views import ExportProjectView, ImportProjectView
from .eda_view import EDAProfileView

urlpatterns = [
    # Pipeline Management
    path('', PipelineListCreateView.as_view(), name='pipeline-list-create'),
    path('<int:pk>/', PipelineDetailView.as_view(), name='pipeline-detail'),
    path('<int:pk>/graph/', GraphUpdateView.as_view(), name='graph-update'),
    path('<int:pk>/validate/', PipelineValidateView.as_view(), name='pipeline-validate'),
    path('<int:pk>/execute/', GraphExecuteView.as_view(), name='graph-execute'),
    path('<int:pk>/stop/', GraphStopView.as_view(), name='graph-stop'),
    path('<int:pk>/download/', DownloadModelBundleView.as_view(), name='download-bundle'),
    path('<int:pk>/download/onnx/', DownloadONNXView.as_view(), name='download-onnx'),
    path('<int:pk>/download/script/', DownloadInferScriptView.as_view(), name='download-script'),
    path('<int:pk>/predict/', PredictView.as_view(), name='predict'),
    path('<int:pk>/nodes/<str:node_id>/run/', NodeRunView.as_view(), name='node-run'),
    path('<int:pk>/nodes/<str:node_id>/preview/', DatasetPreviewView.as_view(), name='dataset-node-preview'),
    path('<int:pk>/nodes/preview/', DatasetPreviewView.as_view(), name='dataset-latest-preview'),

    # Model Registry & Live Prediction API
    path('models/', ModelRegistryListView.as_view(), name='model-registry-list'),
    path('models/<int:id>/', ModelRegistryDetailView.as_view(), name='model-registry-detail'),
    path('models/<int:id>/predict/', RegisteredModelPredictView.as_view(), name='model-registry-predict'),

    # Experiment Tracking & Run Metrics
    path('experiments/', ExperimentRunsListView.as_view(), name='experiments-all-list'),
    path('experiments/export/', ExportExperimentsView.as_view(), name='experiments-all-export'),
    path('runs/<int:run_id>/', ExecutionRunDetailView.as_view(), name='run-detail-direct'),
    path('runs/<int:run_id>/rerun/', ExperimentRerunView.as_view(), name='run-rerun'),
    path('<int:pk>/runs/', PipelineExecutionRunsView.as_view(), name='pipeline-runs-list'),
    path('<int:pk>/runs/<int:run_id>/', ExecutionRunDetailView.as_view(), name='pipeline-run-detail'),
    path('<int:pk>/runs/export/', ExportExperimentsView.as_view(), name='pipeline-runs-export'),

    # ML Report Generation
    path('<int:pk>/report/', GenerateMLReportView.as_view(), name='pipeline-report'),

    # Automated EDA & Data Profiling
    path('<int:pk>/eda/', EDAProfileView.as_view(), name='pipeline-eda'),

    # Project Export & Import
    path('<int:pk>/export/', ExportProjectView.as_view(), name='project-export'),
    path('import/', ImportProjectView.as_view(), name='project-import'),
]
