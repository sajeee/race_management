from django.db import models
from registration.models import Runner
from core.models import Race

class Result(models.Model):
    runner = models.ForeignKey(Runner, on_delete=models.CASCADE)
    race = models.ForeignKey(Race, on_delete=models.CASCADE)
    finish_time = models.DurationField()
    position = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.runner} - {self.race} - {self.finish_time}"
