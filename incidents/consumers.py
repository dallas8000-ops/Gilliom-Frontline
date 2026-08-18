import json

from channels.generic.websocket import AsyncWebsocketConsumer


class IncidentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if user is None or not user.is_authenticated:
            await self.close()
            return
        await self.channel_layer.group_add('incidents', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard('incidents', self.channel_name)

    async def incident_event(self, event):
        await self.send(text_data=json.dumps({
            'event': event['event'],
            'payload': event['payload'],
        }))