import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class RunLogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.pipeline_id = self.scope['url_route']['kwargs']['pipeline_id']
        self.group_name = f'run_{self.pipeline_id}_logs'
        try:
            if self.channel_layer:
                await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug(f"WebSocket connected for pipeline {self.pipeline_id}")
        except Exception as e:
            logger.warning(f"Error in RunLogConsumer connect for pipeline {self.pipeline_id}: {e}")
            try:
                await self.accept()
            except Exception:
                pass

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name') and self.channel_layer:
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception as e:
                logger.warning(f"Error in RunLogConsumer disconnect: {e}")

    async def receive(self, text_data=None, bytes_data=None):
        # Clients can send a ping to keep connection alive; just echo back.
        if text_data:
            try:
                msg = json.loads(text_data)
                if msg.get('type') == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
            except Exception:
                pass

    async def log_message(self, event):
        try:
            await self.send(text_data=json.dumps({
                'message': event.get('message', ''),
                'stage': event.get('stage'),
                'percent': event.get('percent'),
            }))
        except Exception as e:
            logger.warning(f"Error in RunLogConsumer log_message: {e}")