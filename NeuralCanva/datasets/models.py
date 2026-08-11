import uuid
from django.db import models
from accounts.models import User  # your custom User model

class Dataset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='datasets')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='datasets/%Y/%m/')
    columns = models.JSONField(default=list)      # cached column names
    row_count = models.IntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    column_types = models.JSONField(default=dict) 

    def __str__(self):
        return self.name