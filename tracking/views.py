from django.contrib.gis.geos import Point
from django.utils import timezone
from django.db.models import Max
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from core.models import Race
from registration.models import Runner
from tracking.models import TrackingPoint
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from geopy.distance import geodesic
import json

def dashboard(request, race_id):
    """
    Live race dashboard showing each runner’s latest known position.
    """
    race = get_object_or_404(Race, id=race_id)

    # Get all runners who have tracking points in this race
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

    return render(request, "tracking/dashboard.html", {
        "race": race,
        "runners": runner_data,
    })
    
@csrf_exempt
def post_location(request, race_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = json.loads(request.body or "{}")
        runner_id = data.get("runner_id")
        lat = data.get("latitude") or data.get("lat")
        lon = data.get("longitude") or data.get("lng")

        if not (runner_id and lat and lon):
            return JsonResponse({"error": "Missing required fields"}, status=400)

        race = get_object_or_404(Race, id=race_id)
        runner = get_object_or_404(Runner, id=runner_id)
        location = Point(float(lon), float(lat))
        timestamp = timezone.now()

        prev = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("-timestamp")
            .first()
        )

        incremental_distance = 0.0
        if prev:
            prev_coords = (prev.location.y, prev.location.x)
            curr_coords = (float(lat), float(lon))
            dist_m = geodesic(prev_coords, curr_coords).meters
            if dist_m >= 3:
                incremental_distance = dist_m

        tp = TrackingPoint.objects.create(
            runner=runner, race=race, location=location, timestamp=timestamp
        )

        # Total distance and pace
        points = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("timestamp")
            .values_list("location", "timestamp")
        )
        total_distance, total_time = 0.0, 0.0
        prev_point, prev_time = None, None

        for loc, time in points:
            if prev_point:
                segment = geodesic(
                    (prev_point.y, prev_point.x),
                    (loc.y, loc.x)
                ).meters
                if segment >= 3:
                    total_distance += segment
                    total_time += (time - prev_time).total_seconds()
            prev_point, prev_time = loc, time

        pace_min_km = (total_time / 60) / (total_distance / 1000) if total_distance > 0 else 0
        speed_kmh = (total_distance / total_time) * 3.6 if total_time > 0 else 0

        message = {
            "runner_id": runner.id,
            "name": f"{runner.first_name} {runner.last_name}",
            "lat": float(lat),
            "lon": float(lon),
            "distance_m": round(total_distance, 1),
            "pace_min_km": round(pace_min_km, 2),
            "speed_kmh": round(speed_kmh, 2),
            "timestamp": tp.timestamp.strftime("%H:%M:%S"),
        }

        # Broadcast to race group
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"race_{race_id}",
            {"type": "race_update", "message": message},
        )

        # Leaderboard broadcast
        leaderboard = []
        runners = Runner.objects.filter(id__in=TrackingPoint.objects.filter(race=race).values_list("runner_id", flat=True))
        for r in runners:
            pts = TrackingPoint.objects.filter(runner=r, race=race).order_by("timestamp").values_list("location", "timestamp")
            td = 0.0
            prev_p, prev_t = None, None
            for loc, t in pts:
                if prev_p:
                    seg = geodesic((prev_p.y, prev_p.x), (loc.y, loc.x)).meters
                    if seg >= 3:
                        td += seg
                prev_p, prev_t = loc, t
            leaderboard.append({"runner_id": r.id, "name": f"{r.first_name} {r.last_name}", "distance_m": round(td, 1)})

        leaderboard.sort(key=lambda x: x["distance_m"], reverse=True)
        async_to_sync(channel_layer.group_send)(
            f"race_{race_id}",
            {"type": "leaderboard_update", "message": {"leaderboard": leaderboard}},
        )

        return JsonResponse({"status": "ok", "data": message})

    except Exception as e:
        print("❌ post_location error:", str(e))
        return JsonResponse({"error": str(e)}, status=500)

@require_GET
def get_latest_locations(request, race_id):
    """
    Returns the most recent location per runner for this race.
    Used by dashboard.js on page load (to restore data).
    """
    race = get_object_or_404(Race, id=race_id)
    runner_ids = (
        TrackingPoint.objects.filter(race=race)
        .values_list("runner_id", flat=True)
        .distinct()
    )
    runners = Runner.objects.filter(id__in=runner_ids)

    data = []
    for runner in runners:
        last = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("-timestamp")
            .first()
        )
        if last:
            data.append({
                "runner_id": runner.id,
                "name": f"{runner.first_name} {runner.last_name}",
                "lat": last.location.y,
                "lon": last.location.x,
                "timestamp": last.timestamp.strftime("%H:%M:%S"),
            })
    return JsonResponse({"runners": data})
