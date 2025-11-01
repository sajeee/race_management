# tracking/views.py
import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.contrib.gis.geos import Point
from asgiref.sync import sync_to_async
from geopy.distance import geodesic
from .models import TrackingPoint
from registration.models import Runner
from core.models import Race
from .broadcast import broadcast_to_race_async

# optional: require token
import os
TRACKING_API_TOKEN = os.getenv("TRACKING_API_TOKEN", "")

def dashboard(request, race_id):
    race = get_object_or_404(Race, id=race_id)
    # fetch last point per runner more efficiently
    runner_ids = (
        TrackingPoint.objects.filter(race=race)
        .order_by('runner', '-timestamp')
        .values_list('runner', flat=True)
        .distinct()
    )
    runners = Runner.objects.filter(id__in=runner_ids)
    runner_data = []
    for r in runners:
        last_point = TrackingPoint.objects.filter(runner=r, race=race).order_by('-timestamp').first()
        if last_point:
            runner_data.append({
                "runner_id": r.id,
                "bib": getattr(r, "bib", None),
                "name": f"{getattr(r, 'first_name','') } {getattr(r,'last_name','')}".strip(),
                "lat": last_point.location.y,
                "lon": last_point.location.x,
                "distance_m": None,
                "timestamp": last_point.timestamp.strftime("%H:%M:%S"),
            })
    return render(request, "tracking/dashboard.html", {"race": race, "runners": runner_data})

@csrf_exempt
async def post_location(request, race_id):
    """
    Async POST endpoint:
    JSON: { "runner_id": 1, "lat": 33.6, "lon": 73.0, "timestamp": "ISO8601" }
    Header: Authorization: Token <TRACKING_API_TOKEN>   (optional)
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    # token guard (if set)
    if TRACKING_API_TOKEN:
        header = request.headers.get("Authorization", "") or request.META.get("HTTP_AUTHORIZATION", "")
        if not header or not header.startswith("Token ") or header.split(" ", 1)[1] != TRACKING_API_TOKEN:
            return JsonResponse({"error": "Forbidden"}, status=403)

    try:
        body = await request.body
        data = json.loads(body.decode())
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    runner_id = data.get("runner_id") or data.get("id") or data.get("bib")
    lat = data.get("lat") or data.get("latitude")
    lon = data.get("lon") or data.get("longitude")
    ts = data.get("timestamp")

    if not (runner_id and lat is not None and lon is not None):
        return JsonResponse({"error": "Missing fields"}, status=400)

    race = await sync_to_async(get_object_or_404)(Race, id=race_id)
    runner = await sync_to_async(get_object_or_404)(Runner, id=runner_id)

    # create location point
    location = Point(float(lon), float(lat))
    timestamp = timezone.now()

    # fetch last point (sync->async wrapper)
    prev = await sync_to_async(
        lambda: TrackingPoint.objects.filter(runner_id=runner_id, race_id=race_id).order_by("-timestamp").first()
    )()

    incremental = 0.0
    if prev:
        try:
            incremental = geodesic((prev.location.y, prev.location.x), (float(lat), float(lon))).meters
            if incremental < 3:  # jitter threshold
                incremental = 0.0
        except Exception:
            incremental = 0.0

    # persist new point
    tp = await sync_to_async(TrackingPoint.objects.create)(
        runner=runner, race=race, location=location, timestamp=timestamp
    )

    # compute total distance by scanning points for this runner: small races fine; optimize later
    points = await sync_to_async(list)(
        TrackingPoint.objects.filter(runner_id=runner_id, race_id=race_id).order_by("timestamp").values_list("location", "timestamp")
    )
    total_distance = 0.0
    total_time = 0.0
    prev_point, prev_time = None, None
    for loc, t in points:
        if prev_point:
            try:
                d = geodesic((prev_point.y, prev_point.x), (loc.y, loc.x)).meters
                if d > 3:
                    total_distance += d
                    total_time += (t - prev_time).total_seconds()
            except Exception:
                pass
        prev_point, prev_time = loc, t

    pace_spm = (total_time / (total_distance / 1000.0)) if total_distance > 0 else None

    # prepare payload
    payload = {
        "runner_id": runner.id,
        "name": f"{getattr(runner, 'first_name','')} {getattr(runner,'last_name','')}".strip(),
        "lat": float(lat),
        "lon": float(lon),
        "distance_m": round(total_distance, 2),
        "pace_spm": round(pace_spm, 1) if pace_spm else None,
        "timestamp": tp.timestamp.strftime("%H:%M:%S"),
    }

    # broadcast to websocket group (async)
    try:
        await broadcast_to_race_async(race_id, payload)
    except Exception:
        # do not fail the request if broadcast fails
        pass

    return JsonResponse({"status": "ok", "data": payload})
