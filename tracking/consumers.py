import json
import asyncio
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from tracking.models import TrackingPoint
from registration.models import Runner
from core.models import Race
from geopy.distance import geodesic

class RaceTrackerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.race_id = self.scope["url_route"]["kwargs"]["race_id"]
        self.group_name = f"race_{self.race_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "info", "message": f"✅ Connected to race {self.race_id}", "timestamp": datetime.utcnow().isoformat()})
        leaderboard = await sync_to_async(self._build_leaderboard_snapshot)()
        await self.send_json({"type": "leaderboard_snapshot", "data": leaderboard})
        self.keepalive_task = asyncio.create_task(self._keepalive())

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "keepalive_task"):
            self.keepalive_task.cancel()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                await self.send_json({"type": "pong", "time": data.get("time")})
            elif data.get("type") == "simulate":
                await self.channel_layer.group_send(self.group_name, {"type": "race_update", "message": data.get("message", {})})
        except Exception:
            pass

    async def race_update(self, event):
        message = event.get("message", {})
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().strftime("%H:%M:%S")
        await self.send_json({"type": "race_update", "message": message})

    async def leaderboard_update(self, event):
        leaderboard = event.get("leaderboard", [])
        await self.send_json({"type": "leaderboard_update", "data": leaderboard})

    async def send_json(self, data):
        try:
            await self.send(text_data=json.dumps(data))
        except Exception as e:
            print("❌ send_json error:", str(e))

    async def _keepalive(self):
        try:
            while True:
                await asyncio.sleep(25)
                await self.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
        except asyncio.CancelledError:
            pass

    def _build_leaderboard_snapshot(self):
        try:
            race = Race.objects.get(id=self.race_id)
            runner_ids = TrackingPoint.objects.filter(race=race).values_list("runner_id", flat=True).distinct()
            runners = Runner.objects.filter(id__in=runner_ids)
            leaderboard = []
            for runner in runners:
                pts = TrackingPoint.objects.filter(runner=runner, race=race).order_by("timestamp").values_list("location", "timestamp")
                td = 0.0
                prev_p, prev_t = None, None
                for loc, t in pts:
                    if prev_p:
                        seg = geodesic((prev_p.y, prev_p.x), (loc.y, loc.x)).meters
                        if seg >= 3:
                            td += seg
                    prev_p, prev_t = loc, t
                leaderboard.append({"runner_id": runner.id, "name": f"{runner.first_name} {runner.last_name}", "distance_m": round(td, 1)})
            leaderboard.sort(key=lambda x: x["distance_m"], reverse=True)
            return leaderboard
        except Exception as e:
            print("❌ leaderboard snapshot error:", str(e))
            return []
