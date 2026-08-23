from django.db import models
from django.conf import settings


class Pipeline(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pipelines')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.owner.username})"


class Graph(models.Model):
    STATUS_CHOICES = [
        ('idle', 'Idle'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    pipeline = models.OneToOneField(Pipeline, on_delete=models.CASCADE, related_name='graph')
    nodes = models.JSONField(default=list)   # [{"id": "1", "type": "RandomForest", "params": {...}}]
    edges = models.JSONField(default=list)   # [{"source": "1", "target": "2"}]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='idle')
    result = models.JSONField(null=True, blank=True)
    node_outputs = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    elapsed_seconds = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Graph for {self.pipeline.name}"


class TrainedModel(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trained_models')
    pipeline = models.ForeignKey(Pipeline, on_delete=models.SET_NULL, null=True, blank=True, related_name='models')
    name = models.CharField(max_length=255)
    version = models.PositiveIntegerField(default=1)
    algorithm = models.CharField(max_length=100)
    dataset_name = models.CharField(max_length=255, blank=True)
    target_column = models.CharField(max_length=255, blank=True)
    features = models.JSONField(default=list)
    metrics = models.JSONField(default=dict)
    preprocessing_steps = models.JSONField(default=list)
    model_b64 = models.TextField(blank=True)
    model_format = models.CharField(max_length=20, default='pkl')
    status = models.CharField(max_length=50, default='ready')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('owner', 'name', 'version')

    def __str__(self):
        return f"{self.name} (v{self.version}) - {self.algorithm}"


class PipelineExecutionRun(models.Model):
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name='execution_runs')
    run_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, default='success')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    elapsed_seconds = models.FloatField(null=True, blank=True)
    nodes_snapshot = models.JSONField(default=list)
    node_outputs = models.JSONField(default=dict)
    node_timings = models.JSONField(default=dict)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f"Run #{self.run_number} for {self.pipeline.name} ({self.status})"