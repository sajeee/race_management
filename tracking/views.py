from django.contrib.gis.geos import Point
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from registration.models import Runner
from core.models import Race
from .models import TrackingPoint
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from geopy.distance import geodesic
import json

def dashboard(request, race_id):
    race = get_object_or_404(Race, id=race_id)
    runner_ids = TrackingPoint.objects.filter(race=race).values_list("runner_id", flat=True).distinct()
    runners = Runner.objects.filter(id__in=runner_ids)

    runner_data = []
    for runner in runners:
        last_point = TrackingPoint.objects.filter(runner=runner, race=race).order_by("-timestamp").first()
        if last_point:
            runner_data.append({
                "runner_id": runner.id,
                "name": f"{runner.first_name} {runner.last_name}",
                "lat": last_point.location.y,
                "lon": last_point.location.x,
                "time": last_point.timestamp.strftime("%H:%M:%S"),
            })

    context = {"race": race, "runners": runner_data}
    return render(request, "tracking/dashboard.html", context)

@csrf_exempt
def post_location(request, race_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = json.loads(request.body)
        runner_id = data.get("runner_id")
        lat = data.get("latitude") or data.get("lat")
        lon = data.get("longitude") or data.get("lng")

        if not (runner_id and lat and lon):
            return JsonResponse({"error": "Missing fields"}, status=400)

        race = get_object_or_404(Race, id=race_id)
        runner = get_object_or_404(Runner, id=runner_id)
        location = Point(float(lon), float(lat))
        timestamp = timezone.now()

        # Save new tracking point
        tp = TrackingPoint.objects.create(runner=runner, race=race, location=location, timestamp=timestamp)

        # --- Compute total distance from first point ---
        points = TrackingPoint.objects.filter(runner=runner, race=race).order_by("timestamp")
        total_distance = 0.0
        prev_point = None
        for p in points:
            if prev_point:
                segment = geodesic(
                    (prev_point.location.y, prev_point.location.x),
                    (p.location.y, p.location.x)
                ).meters
                if segment > 0.5:  # ignore GPS jitter
                    total_distance += segment
            prev_point = p

        # --- Compute pace (min/km) ---
        first_time = points.first().timestamp
        total_seconds = (timestamp - first_time).total_seconds()
        pace_m_per_km = (total_seconds / (total_distance / 1000)) if total_distance > 0 else 0

        message = {
            "runner_id": runner.id,
            "name": f"{runner.first_name} {runner.last_name}",
            "lat": float(lat),
            "lon": float(lon),
            "distance_m": round(total_distance, 2),
            "pace_m_per_km": round(pace_m_per_km, 2) if pace_m_per_km else None,
            "timestamp": tp.timestamp.strftime("%H:%M:%S"),
        }

        # Broadcast via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"race_{race_id}",
            {"type": "race_update", "message": message},
        )

        return JsonResponse({"status": "ok", "data": message})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
