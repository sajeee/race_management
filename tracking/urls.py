#tracking/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("race/<int:race_id>/dashboard/", views.dashboard, name="dashboard"),
    path("api/tracking/<int:race_id>/post_location/", views.post_location, name="post_location"),
    path("api/tracking/<int:race_id>/latest/", views.get_latest_locations, name="get_latest_locations"),
]
