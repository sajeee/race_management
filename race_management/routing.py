from django.urls import re_path
from tracking.consumers import RaceConsumer

websocket_urlpatterns = [
    re_path(r'ws/race/(?P<race_id>\d+)/$', RaceConsumer.as_asgi()),
]
