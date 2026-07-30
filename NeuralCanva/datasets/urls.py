from django.urls import path
from .views import DatasetListCreateView, DatasetColumnsView

urlpatterns = [
    path('', DatasetListCreateView.as_view(), name='dataset-list-create'),
    path('<uuid:id>/', DatasetColumnsView.as_view(), name='dataset-detail'),
]