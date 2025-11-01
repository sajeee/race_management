# tracking/__init__.py
default_app_config = "tracking.apps.TrackingConfig"

# or simply import signals to ensure registration:
from . import signals  # noqa
