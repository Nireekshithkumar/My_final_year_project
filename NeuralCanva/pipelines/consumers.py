import json
from channels.generic.websocket import AsyncWebsocketConsumer


class RunLogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.pipeline_id = self.scope['url_route']['kwargs']['pipeline_id']
        self.group_name = f'run_{self.pipeline_id}_logs'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def log_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'stage': event.get('stage'),
            'percent': event.get('percent'),
        }))