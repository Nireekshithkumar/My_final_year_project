from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/runs/(?P<pipeline_id>[\w-]+)/logs/$', consumers.RunLogConsumer.as_asgi()),
]