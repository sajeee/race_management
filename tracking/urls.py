from django.urls import path
from . import views

app_name = 'tracking'

urlpatterns = [
    path('', views.dashboard_home, name='dashboard_home'),
    path('<int:race_id>/dashboard/', views.dashboard, name='dashboard'),
]
