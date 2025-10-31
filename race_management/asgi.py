# race_management/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "race_management.settings")

# First, initialize Django (this calls django.setup())
django_asgi_app = get_asgi_application()

# Now safe to import anything using models
import tracking.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(tracking.routing.websocket_urlpatterns)
    ),
})



