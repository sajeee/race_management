# tracking/consumers.py
import json
import asyncio
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer

class RaceTrackerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.race_id = self.scope['url_route']['kwargs']['race_id']
        self.group_name = f"race_{self.race_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # send connection confirmation
        await self.send_json({
            "type": "info",
            "message": f"✅ Connected to race {self.race_id}",
            "timestamp": datetime.utcnow().isoformat()
        })
        print(f"📡 WebSocket connected: {self.group_name}")

        # Start keep-alive ping loop
        self.keepalive_task = asyncio.create_task(self.keep_alive())

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "keepalive_task"):
            self.keepalive_task.cancel()
        print(f"⚠️ WebSocket disconnected: {self.group_name}")

    async def keep_alive(self):
        """Send periodic ping messages to prevent Railway/Heroku timeout."""
        try:
            while True:
                await asyncio.sleep(25)  # every 25 seconds
                await self.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
        except asyncio.CancelledError:
            pass

    async def receive(self, text_data):
        """Handle messages from the dashboard (for simulation/testing)."""
        try:
            data = json.loads(text_data)
            if data.get("type") == "simulate":
                await self.channel_layer.group_send(
                    self.group_name,
                    {"type": "race_update", "message": data["message"]}
                )
                print("🧪 Simulated update:", data["message"])
        except Exception as e:
            print("❌ receive() error:", e)

    async def race_update(self, event):
        """Send live updates from backend to dashboard."""
        msg = event.get("message", {})
        if "timestamp" not in msg:
            msg["timestamp"] = datetime.utcnow().strftime("%H:%M:%S")
        await self.send_json(msg)

    async def send_json(self, data):
        """Helper for safe JSON transmission."""
        try:
            await self.send(text_data=json.dumps(data))
        except Exception as e:
            print("❌ send_json error:", str(e))
