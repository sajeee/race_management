# tracking/views.py
from django.contrib.gis.geos import Point
from django.utils import timezone
from django.db.models import Sum
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
    Render dashboard page — dashboard.html will request latest positions via JS.
    """
    race = get_object_or_404(Race, id=race_id)
    return render(request, "tracking/dashboard.html", {"race": race})


@require_GET
def get_latest_locations(request, race_id):
    """
    Return JSON of latest point per runner for the race (used to repopulate dashboard after refresh).
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
            # compute total distance & pace for this runner (same logic as post_location)
            points = (
                TrackingPoint.objects.filter(runner=runner, race=race)
                .order_by("timestamp")
                .values_list("location", "timestamp")
            )
            total_distance = 0.0
            total_time = 0.0
            prev_point, prev_time = None, None
            for loc, time in points:
                if prev_point:
                    seg = geodesic((prev_point.y, prev_point.x), (loc.y, loc.x)).meters
                    if seg >= 3:
                        total_distance += seg
                        total_time += (time - prev_time).total_seconds()
                prev_point, prev_time = loc, time

            pace_min_km = (total_time / 60) / (total_distance / 1000) if total_distance > 0 else None
            speed_kmh = (total_distance / total_time) * 3.6 if total_time > 0 else None

            data.append({
                "runner_id": runner.id,
                "name": f"{runner.first_name} {runner.last_name}",
                "lat": last.location.y,
                "lon": last.location.x,
                "timestamp": last.timestamp.strftime("%H:%M:%S"),
                "distance_m": round(total_distance, 1),
                "pace_min_km": round(pace_min_km, 2) if pace_min_km else None,
                "speed_kmh": round(speed_kmh, 2) if speed_kmh else None,
            })

    return JsonResponse({"runners": data})


@csrf_exempt
def post_location(request, race_id):
    """
    Receives live GPS data and broadcasts updates:
    {
        "runner_id": 1,
        "latitude": 33.6844,
        "longitude": 73.0479
    }

    Broadcasts:
      - group_send type 'race_update' with message (single runner update)
      - group_send type 'leaderboard_update' with message {"leaderboard": [...]}
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        # parse JSON safely
        body = request.body.decode("utf-8") if isinstance(request.body, (bytes, bytearray)) else request.body
        data = json.loads(body or "{}")
        runner_id = data.get("runner_id")
        lat = data.get("latitude") or data.get("lat")
        lon = data.get("longitude") or data.get("lng")

        if not (runner_id and lat is not None and lon is not None):
            return JsonResponse({"error": "Missing required fields"}, status=400)

        race = get_object_or_404(Race, id=race_id)
        runner = get_object_or_404(Runner, id=runner_id)

        location = Point(float(lon), float(lat))
        timestamp = timezone.now()

        # previous point
        prev = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("-timestamp")
            .first()
        )

        incremental_distance = 0.0
        if prev:
            prev_coords = (prev.location.y, prev.location.x)
            curr_coords = (float(lat), float(lon))
            d = geodesic(prev_coords, curr_coords).meters
            if d >= 3:
                incremental_distance = d

        # save
        tp = TrackingPoint.objects.create(runner=runner, race=race, location=location, timestamp=timestamp)

        # total distance and time
        points = (
            TrackingPoint.objects.filter(runner=runner, race=race)
            .order_by("timestamp")
            .values_list("location", "timestamp")
        )
        total_distance, total_time = 0.0, 0.0
        prev_point, prev_time = None, None
        for loc, time in points:
            if prev_point:
                seg = geodesic((prev_point.y, prev_point.x), (loc.y, loc.x)).meters
                if seg >= 3:
                    total_distance += seg
                    total_time += (time - prev_time).total_seconds()
            prev_point, prev_time = loc, time

        pace_min_km = (total_time / 60) / (total_distance / 1000) if total_distance > 0 else None
        speed_kmh = (total_distance / total_time) * 3.6 if total_time > 0 else None

        runner_message = {
            "runner_id": runner.id,
            "name": f"{runner.first_name} {runner.last_name}",
            "lat": float(lat),
            "lon": float(lon),
            "distance_m": round(total_distance, 1),
            "incremental_m": round(incremental_distance, 2),
            "pace_min_km": round(pace_min_km, 2) if pace_min_km else None,
            "speed_kmh": round(speed_kmh, 2) if speed_kmh else None,
            "timestamp": tp.timestamp.strftime("%H:%M:%S"),
        }

        # broadcast runner update
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"race_{race_id}",
            {"type": "race_update", "message": runner_message},
        )

        # compute simple leaderboard (small races—OK). For large races optimize later.
        leaderboard = []
        runner_ids = TrackingPoint.objects.filter(race=race).values_list("runner_id", flat=True).distinct()
        runners = Runner.objects.filter(id__in=runner_ids)
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
            {"type": "leaderboard_update", "leaderboard": leaderboard},
        )

        return JsonResponse({"status": "ok", "data": runner_message})

    except Exception as e:
        print("❌ post_location error:", str(e))
        return JsonResponse({"error": str(e)}, status=500)
