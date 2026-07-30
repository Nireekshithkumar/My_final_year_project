import pandas as pd
from rest_framework import serializers
from .models import Dataset

class DatasetUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ['id', 'name', 'file', 'columns', 'row_count', 'uploaded_at']
        read_only_fields = ['id', 'columns', 'row_count', 'uploaded_at']

    def create(self, validated_data):
        instance = Dataset.objects.create(
            owner=self.context['request'].user,
            **validated_data
        )
        # peek at the file to cache columns — avoids re-reading the full CSV on every canvas load
        try:
            df = pd.read_csv(instance.file.path, nrows=500)
            full_len = sum(1 for _ in open(instance.file.path)) - 1
            instance.columns = list(df.columns)
            instance.row_count = full_len
            instance.save(update_fields=['columns', 'row_count'])
        except Exception:
            pass  # bad file — leave columns empty, frontend can show an error state
        return instance