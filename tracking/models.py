from django.contrib.gis.db import models
from registration.models import Runner
from core.models import Race

class TrackingPoint(models.Model):
    runner = models.ForeignKey(Runner, on_delete=models.CASCADE)
    race = models.ForeignKey(Race, on_delete=models.CASCADE)
    location = models.PointField()  # GIS Field!
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.runner} @ {self.timestamp}"
