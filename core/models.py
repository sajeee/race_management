from django.db import models
from registration.models import RaceCategory

class Race(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(RaceCategory, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    location = models.CharField(max_length=200)
    is_active = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.category.name})"
