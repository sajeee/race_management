# tracking/views.py

from django.contrib.gis.geos import Point
from django.utils import timezone
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from geopy.distance import geodesic
import json

from core.models import Race
from registration.models import Runner
from .models import TrackingPoint


def dashboard(request, race_id):
    """
    Display live dashboard showing each runner’s last known position for a race.
    """
    race = get_object_or_404(Race, id=race_id)

    runner_ids = (
        TrackingPoint.objects.filter(race=race)
        .values_list("runner_id", flat=True)
        .distinct()
    )
    runners = Runner.objects.filter(id__in=runner_ids)

    runner_data = []
    for runner in runners:
        last_point = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("-timestamp")
            .first()
        )
        if last_point:
            runner_data.append({
                "name": f"{runner.first_name} {runner.last_name}",
                "lat": last_point.location.y,
                "lng": last_point.location.x,
                "time": last_point.timestamp.strftime("%H:%M:%S"),
            })

    context = {
        "race": race,
        "runners": runner_data,
    }
    return render(request, "tracking/dashboard.html", context)


@csrf_exempt
def post_location(request, race_id):
    """
    Receives live GPS data and updates the live race.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        data = json.loads(request.body.decode())
        runner_id = data.get("runner_id")
        lat = data.get("latitude") or data.get("lat")
        lon = data.get("longitude") or data.get("lng")

        if not all([runner_id, lat, lon]):
            return JsonResponse({"error": "Missing required fields"}, status=400)

        race = get_object_or_404(Race, id=race_id)
        runner = get_object_or_404(Runner, id=runner_id)

        # Save new tracking point
        location = Point(float(lon), float(lat))
        timestamp = timezone.now()
        tp = TrackingPoint.objects.create(runner=runner, race=race, location=location, timestamp=timestamp)

        # Compute total distance & pace
        points = TrackingPoint.objects.filter(runner=runner, race=race).order_by("timestamp").values_list("location", "timestamp")
        total_distance = 0.0
        total_time = 0.0
        prev_point, prev_time = None, None
        for loc, time in points:
            if prev_point:
                prev_coords = (prev_point.y, prev_point.x)
                curr_coords = (loc.y, loc.x)
                segment_dist = geodesic(prev_coords, curr_coords).meters
                if segment_dist > 3:  # ignore GPS jitter
                    total_distance += segment_dist
                    total_time += (time - prev_time).total_seconds()
            prev_point, prev_time = loc, time

        pace_spm = (total_time / (total_distance / 1000)) if total_distance > 0 else 0

        # Prepare message
        message = {
            "runner_id": runner.id,
            "name": f"{runner.first_name} {runner.last_name}",
            "lat": float(lat),
            "lon": float(lon),
            "distance_m": round(total_distance, 2),
            "pace_spm": round(pace_spm, 1) if pace_spm else None,
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
