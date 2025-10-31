# tracking/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from datetime import datetime


class RaceTrackerConsumer(AsyncWebsocketConsumer):
    """
    Handles WebSocket connections for live race tracking.
    - Each race has its own group (e.g. 'race_1')
    - Receives messages from the Django backend via group_send
    - Broadcasts live runner data to all connected dashboard clients
    """

    async def connect(self):
        self.race_id = self.scope["url_route"]["kwargs"]["race_id"]
        self.group_name = f"race_{self.race_id}"

        # Join race group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send confirmation message
        await self.send_json({
            "type": "info",
            "message": f"✅ Connected to race {self.race_id}",
            "timestamp": datetime.utcnow().isoformat()
        })
        print(f"📡 WebSocket connected to {self.group_name}")

    async def disconnect(self, close_code):
        # Leave race group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print(f"⚠️ WebSocket disconnected from {self.group_name}")

    async def receive(self, text_data):
        """
        Handle any message coming *from* the browser (dashboard or testing client).
        Normally dashboards only receive, but we allow simulateRunner() to push test updates.
        """
        try:
            data = json.loads(text_data)
            if data.get("type") == "simulate":
                # Broadcast simulated location updates for testing
                await self.channel_layer.group_send(
                    self.group_name,
                    {"type": "race_update", "message": data["message"]}
                )
                print("🧪 Simulated broadcast:", data["message"])
            else:
                print("📩 Received client message:", data)
        except Exception as e:
            print("❌ Error handling client message:", str(e))

    async def race_update(self, event):
        """
        Called by backend (views.post_location) whenever a new runner location is posted.
        """
        message = event.get("message", {})
        try:
            # Ensure timestamp is formatted properly
            if "timestamp" not in message:
                message["timestamp"] = datetime.utcnow().strftime("%H:%M:%S")

            # Send to all connected dashboard clients
            await self.send_json(message)
        except Exception as e:
            print("❌ Error sending race_update:", str(e))

    # Helper: safe JSON sending
    async def send_json(self, data):
        try:
            await self.send(text_data=json.dumps(data))
        except Exception as e:
            print("❌ send_json error:", str(e))
