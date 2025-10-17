from django.db import models
from registration.models import Runner

class Notification(models.Model):
    runner = models.ForeignKey(Runner, on_delete=models.CASCADE, null=True, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    sent = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification: {self.message[:50]}"
