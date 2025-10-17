# core/admin.py
from django.contrib import admin
from .models import Race

@admin.register(Race)
class RaceAdmin(admin.ModelAdmin):
    list_display = ('name','category','start_time','is_active')
    list_filter = ('is_active','category')
