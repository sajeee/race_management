from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.utils import timezone
from django.db.models import Sum
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from core.models import Race
from registration.models import Runner
from tracking.models import TrackingPoint
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from geopy.distance import geodesic
import json
import math

def dashboard(request, race_id):
    """
    Display live dashboard showing each runner’s last known position for a race.
    Works even if Runner has no direct race FK.
    """
    race = get_object_or_404(Race, id=race_id)

    # Get all runners who have any TrackingPoint in this race
    runner_ids = (
        TrackingPoint.objects.filter(race=race)
        .values_list("runner_id", flat=True)
        .distinct()
    )
    runners = Runner.objects.filter(id__in=runner_ids)

    runner_data = []
    for runner in runners:
        # Get the most recent tracking point for each runner
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
    Receives live GPS data and updates the live race:
    {
        "runner_id": 1,
        "latitude": 33.6844,
        "longitude": 73.0479
    }
    """

    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = json.loads(request.body)
        runner_id = data.get("runner_id")
        lat = data.get("latitude") or data.get("lat")
        lon = data.get("longitude") or data.get("lng")

        if not (runner_id and lat and lon):
            return JsonResponse({"error": "Missing required fields"}, status=400)

        race = get_object_or_404(Race, id=race_id)
        runner = get_object_or_404(Runner, id=runner_id)

        # Convert to Point (for GIS storage)
        location = Point(float(lon), float(lat))
        timestamp = timezone.now()

        # Get last tracking point for this runner/race
        prev = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("-timestamp")
            .first()
        )

        # --- Compute incremental distance ---
        incremental_distance = 0.0
        if prev:
            prev_coords = (prev.location.y, prev.location.x)
            curr_coords = (float(lat), float(lon))
            incremental_distance = geodesic(prev_coords, curr_coords).meters

            # ignore GPS jitter (tiny random shifts)
            if incremental_distance < 3:
                incremental_distance = 0.0

        # Save the new tracking point
        tp = TrackingPoint.objects.create(
            runner=runner, race=race, location=location, timestamp=timestamp
        )

        # --- Compute total distance and pace ---
        points = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("timestamp")
            .values_list("location", "timestamp")
        )

        total_distance = 0.0  # in meters
        total_time = 0.0      # in seconds
        prev_point, prev_time = None, None

        for loc, time in points:
            if prev_point:
                prev_coords = (prev_point.y, prev_point.x)
                curr_coords = (loc.y, loc.x)
                segment_dist = geodesic(prev_coords, curr_coords).meters
                # again, ignore GPS noise below 3m
                if segment_dist > 3:
                    total_distance += segment_dist
                    total_time += (time - prev_time).total_seconds()
            prev_point, prev_time = loc, time

        # --- Compute pace (seconds per km) ---
        pace_spm = (total_time / (total_distance / 1000)) if total_distance > 0 else 0

        # --- Prepare broadcast payload ---
        message = {
            "runner_id": runner.id,
            "name": f"{runner.first_name} {runner.last_name}",
            "lat": float(lat),
            "lon": float(lon),
            "distance_m": round(total_distance, 2),
            "pace_spm": round(pace_spm, 1) if pace_spm else None,
            "timestamp": tp.timestamp.strftime("%H:%M:%S"),
        }

        print("📡 Broadcasting message:", message)

        # --- Send via WebSocket to dashboard ---
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"race_{race_id}",
            {"type": "race_update", "message": message},
        )

        return JsonResponse({"status": "ok", "data": message})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

