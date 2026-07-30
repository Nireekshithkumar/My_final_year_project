from rest_framework import generics, permissions
from accounts.authentication import CsrfExemptSessionAuthentication
from .models import Dataset
from .serializers import DatasetUploadSerializer


class DatasetListCreateView(generics.ListCreateAPIView):
    serializer_class = DatasetUploadSerializer
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Dataset.objects.filter(owner=self.request.user).order_by('-uploaded_at')


class DatasetColumnsView(generics.RetrieveAPIView):
    serializer_class = DatasetUploadSerializer
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = Dataset.objects.all()
    lookup_field = 'id'

    def get_queryset(self):
        return Dataset.objects.filter(owner=self.request.user)