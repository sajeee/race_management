# tracking/consumers.py
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class RaceTrackerConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.race_id = self.scope['url_route']['kwargs']['race_id']
        self.group_name = f"race_{self.race_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "info", "message": f"Connected to race {self.race_id}"})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Channels maps "type": "race_update" -> method name "race_update"
    async def race_update(self, event):
        # event contains 'message'
        await self.send_json(event.get("message"))

    # Keep this handler if you want to accept messages from clients
    async def receive_json(self, content):
        cmd = content.get("cmd")
        if cmd == "get_last":
            # optional: implement last positions fetch
            await self.send_json({"type": "info", "message": "server: get_last not implemented"})
