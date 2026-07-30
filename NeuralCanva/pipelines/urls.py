from django.urls import path
from .views import PipelineListCreateView, PipelineDetailView, GraphUpdateView, GraphExecuteView
from .download import DownloadModelBundleView

urlpatterns = [
    path('', PipelineListCreateView.as_view(), name='pipeline-list-create'),
    path('<int:pk>/', PipelineDetailView.as_view(), name='pipeline-detail'),
    path('<int:pk>/graph/', GraphUpdateView.as_view(), name='graph-update'),
    path('<int:pk>/execute/', GraphExecuteView.as_view(), name='graph-execute'),
    path('graphs/<int:graph_id>/download/', DownloadModelBundleView.as_view(), name='download-bundle'),
]

