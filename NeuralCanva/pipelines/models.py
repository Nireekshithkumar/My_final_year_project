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
    error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    # pipelines/models.py — add to Graph model
    elapsed_seconds = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Graph for {self.pipeline.name}"