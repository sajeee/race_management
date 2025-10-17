# tracking/admin.py
from django.contrib import admin
from .models import TrackingPoint
from registration.models import Runner
from core.models import Race

@admin.register(TrackingPoint)
class TrackingPointAdmin(admin.ModelAdmin):
    list_display = ('runner', 'race', 'location', 'timestamp' if hasattr(TrackingPoint, 'timestamp') else 'recorded_at')
    list_filter = ('race',)
    readonly_fields = ('timestamp' if hasattr(TrackingPoint, 'timestamp') else 'recorded_at',)
