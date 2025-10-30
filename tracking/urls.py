from django.urls import path
from . import views

urlpatterns = [
    # Live dashboard (for viewing)
    path("tracking/race/<int:race_id>/dashboard/", views.dashboard, name="dashboard"),

    # Live GPS updates (for Tasker or mobile app)
    path("tracking/race/<int:race_id>/post_location/", views.post_location, name="post_location"),
]

