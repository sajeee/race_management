# tracking/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class RaceTrackerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.race_id = self.scope['url_route']['kwargs']['race_id']
        self.group_name = f"race_{self.race_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "info",
            "message": f"Connected to race {self.race_id}"
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def race_update(self, event):
        """Send live updates to WebSocket clients."""
        msg = event.get("message", {})
        await self.send(text_data=json.dumps(msg))

