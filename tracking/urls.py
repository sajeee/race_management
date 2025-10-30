# tracking/urls.py
from django.urls import path
from . import views

app_name = 'tracking'

urlpatterns = [
    path('', views.dashboard, name='dashboard_home'),  # ✅ use existing view
    path('<int:race_id>/dashboard/', views.dashboard, name='dashboard'),
]
