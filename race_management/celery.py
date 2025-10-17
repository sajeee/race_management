import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'race_management.settings')

app = Celery('race_management')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
