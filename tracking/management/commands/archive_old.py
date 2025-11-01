# tracking/management/commands/archive_old.py
from django.core.management.base import BaseCommand
from tracking.models import TrackingPoint
from core.models import Race
from django.utils import timezone
import csv
import os

class Command(BaseCommand):
    help = "Archive all TrackingPoints that are not part of currently running races"

    def handle(self, *args, **options):
        qs = TrackingPoint.objects.exclude(race__state='running')
        if not qs.exists():
            self.stdout.write("No points to archive.")
            return
        ts = timezone.now().strftime("%Y%m%d%H%M%S")
        fname = f"/tmp/trackingpoints_{ts}.csv"
        with open(fname, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["race_id", "runner_id", "lon", "lat", "timestamp"])
            for p in qs.iterator():
                w.writerow([p.race_id, p.runner_id, p.location.x, p.location.y, p.timestamp.isoformat()])
        # TODO: upload fname to S3 / object storage if required
        count = qs.count()
        qs.delete()
        Race.objects.filter(state='finished').exclude(pk__in=[]).update(state='archived')
        self.stdout.write(f"Archived {count} points to {fname} and deleted them.")

