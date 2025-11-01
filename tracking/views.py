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
def post_location(request, race_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        data = json.loads(request.body.decode())
        runner_id = data.get("runner_id")
        lat = data.get("latitude")
        lon = data.get("longitude")

        if not all([runner_id, lat, lon]):
            return JsonResponse({"error": "Missing data"}, status=400)

        runner = get_object_or_404(Runner, id=runner_id)
        race = get_object_or_404(Race, id=race_id)

        # Save tracking point
        TrackingPoint.objects.create(
            runner=runner,
            race=race,
            location=f"POINT({lon} {lat})",
            timestamp=timezone.now()
        )

        # Broadcast to WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"race_{race_id}",
            {
                "type": "race_update",
                "message": {
                    "runner_id": runner.id,
                    "name": str(runner),
                    "lat": lat,
                    "lon": lon,
                    "timestamp": timezone.now().strftime("%H:%M:%S"),
                },
            },
        )

        return JsonResponse({"status": "ok"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

