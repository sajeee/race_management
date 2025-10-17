from django.db import models

class RaceCategory(models.Model):
    name = models.CharField(max_length=100)  # 5K, 10K, Half Marathon, etc.
    distance_km = models.FloatField()

    def __str__(self):
        return f"{self.name} ({self.distance_km} km)"


class Runner(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    bib_number = models.PositiveIntegerField(unique=True)
    category = models.ForeignKey(RaceCategory, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.bib_number} - {self.first_name} {self.last_name}"
