from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from accounts.authentication import CsrfExemptSessionAuthentication
from common.storage import StorageAbstraction
from .models import Dataset
from .serializers import DatasetUploadSerializer
from .profiler import DatasetProfiler


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


class DatasetProfileView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        dataset = get_object_or_404(Dataset, id=id, owner=request.user)
        try:
            profile_data = DatasetProfiler.profile_dataset(dataset)
            return Response(profile_data)
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=400)


class DatasetTargetDetectionView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        dataset = get_object_or_404(Dataset, id=id, owner=request.user)
        target_override = request.GET.get('target')
        try:
            df = StorageAbstraction.read_dataset_df(dataset)
            suggestions = DatasetProfiler.suggest_targets(df)
            chosen_target = target_override if (target_override and target_override in df.columns) else (suggestions[0]["column"] if suggestions else None)
            task_info = DatasetProfiler.detect_task(df, chosen_target)
            leakage_warnings = DatasetProfiler.detect_data_leakage(df, chosen_target) if chosen_target else []

            return Response({
                "dataset_id": str(dataset.id),
                "target_suggestions": suggestions,
                "selected_target": chosen_target,
                "detected_task": task_info,
                "leakage_warnings": leakage_warnings,
            })
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=400)