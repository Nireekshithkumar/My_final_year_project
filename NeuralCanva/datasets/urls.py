from django.urls import path
from .views import (
    DatasetListCreateView,
    DatasetColumnsView,
    DatasetProfileView,
    DatasetTargetDetectionView,
)

urlpatterns = [
    path('', DatasetListCreateView.as_view(), name='dataset-list-create'),
    path('<uuid:id>/', DatasetColumnsView.as_view(), name='dataset-detail'),
    path('<uuid:id>/profile/', DatasetProfileView.as_view(), name='dataset-profile'),
    path('<uuid:id>/detect-target/', DatasetTargetDetectionView.as_view(), name='dataset-detect-target'),
]