# tracking/models.py
from django.contrib.gis.db import models
from registration.models import Runner
from core.models import Race
from django.utils import timezone

class TrackingPoint(models.Model):
    runner = models.ForeignKey(Runner, on_delete=models.CASCADE)
    race = models.ForeignKey(Race, on_delete=models.CASCADE)
    location = models.PointField()  # GIS Field (x=lon, y=lat)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['runner', '-timestamp']),
            models.Index(fields=['race', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.runner} @ {self.timestamp}"

