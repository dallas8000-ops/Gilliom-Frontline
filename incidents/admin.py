from django.contrib import admin

from .models import CustodyLogEntry, Incident


class CustodyLogEntryInline(admin.TabularInline):
    model = CustodyLogEntry
    extra = 0
    readonly_fields = ['created_at']


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ['case_id', 'title', 'location', 'severity', 'status', 'reported_by', 'created_at']
    list_filter = ['severity', 'status', 'category']
    search_fields = ['case_id', 'title', 'location']
    readonly_fields = ['case_id', 'created_at']
    inlines = [CustodyLogEntryInline]


@admin.register(CustodyLogEntry)
class CustodyLogEntryAdmin(admin.ModelAdmin):
    list_display = ['incident', 'author', 'created_at']