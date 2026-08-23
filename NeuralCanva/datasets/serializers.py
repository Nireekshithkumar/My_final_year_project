import logging
import pandas as pd
from rest_framework import serializers
from common.storage import StorageAbstraction
from .models import Dataset

logger = logging.getLogger(__name__)

class DatasetUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ['id', 'name', 'file', 'columns', 'row_count', 'column_types', 'uploaded_at']
        read_only_fields = ['id', 'columns', 'row_count', 'uploaded_at']

    def create(self, validated_data):
        instance = Dataset.objects.create(
            owner=self.context['request'].user,
            **validated_data
        )
        try:
            df = StorageAbstraction.read_dataset_df(instance, nrows=500)
            instance.columns = list(df.columns)
            instance.column_types = self._detect_types(df)
            
            # Count total rows safely
            try:
                full_df = StorageAbstraction.read_dataset_df(instance)
                instance.row_count = len(full_df)
            except Exception:
                instance.row_count = len(df)
            
            instance.save(update_fields=['columns', 'row_count', 'column_types'])
        except Exception as e:
            logger.warning(f"Metadata extraction for uploaded dataset '{instance.name}' warning: {e}")
        return instance
    
    def _detect_types(self, df):
        types = {}
        for col in df.columns:
            series = df[col].dropna()
            if series.empty:
                types[col] = "text"
                continue
            if pd.api.types.is_bool_dtype(series):
                types[col] = "boolean"
            elif pd.api.types.is_numeric_dtype(series):
                types[col] = "numerical"
            else:
                try:
                    pd.to_datetime(series, errors='raise')
                    types[col] = "datetime"
                    continue
                except (ValueError, TypeError):
                    pass
                unique_ratio = series.nunique() / len(series)
                avg_len = series.astype(str).str.len().mean()
                if unique_ratio < 0.5 and avg_len < 30:
                    types[col] = "categorical"
                else:
                    types[col] = "text"
        return types