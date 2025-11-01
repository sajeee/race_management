# tracking/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import Race
from django.conf import settings
import threading
import subprocess
import os

@receiver(post_save, sender=Race)
def on_race_state_change(sender, instance, created, **kwargs):
    """
    When a race becomes 'running', archive previous races' tracking points.
    Uses Celery task if available (tracking.tasks.archive_old), else falls back to running manage.py command in a background thread.
    """
    # We only trigger on explicit start
    if instance.state == "running":
        # try to call Celery task
        try:
            from .tasks import archive_old
            archive_old.delay()
            return
        except Exception:
            # fallback: run management command in a thread to avoid blocking
            def run_cmd():
                try:
                    manage_py = os.path.join(settings.BASE_DIR, "manage.py")
                    subprocess.call(["python", manage_py, "archive_old"])
                except Exception:
                    pass
            t = threading.Thread(target=run_cmd, daemon=True)
            t.start()

