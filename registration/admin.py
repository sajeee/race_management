# registration/admin.py
from django.contrib import admin
from .models import Runner, RaceCategory

@admin.register(Runner)
class RunnerAdmin(admin.ModelAdmin):
    list_display = ('bib_number','first_name','last_name','email')
    search_fields = ('bib_number','first_name','last_name')

@admin.register(RaceCategory)
class RaceCategoryAdmin(admin.ModelAdmin):
    list_display = ('name','distance_km')
