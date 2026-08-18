from rest_framework import serializers

from .models import CustodyLogEntry, Incident


class CustodyLogEntrySerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = CustodyLogEntry
        fields = ['id', 'text', 'author_name', 'created_at']

    def get_author_name(self, obj):
        return obj.author.get_username() if obj.author else 'System'


class IncidentSerializer(serializers.ModelSerializer):
    log = CustodyLogEntrySerializer(source='log_entries', many=True, read_only=True)
    reported_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            'case_id', 'title', 'location', 'category', 'severity', 'status',
            'description', 'reported_by_name', 'created_at', 'log',
        ]

    def get_reported_by_name(self, obj):
        return obj.reported_by.get_username() if obj.reported_by else 'Unknown'


class IncidentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = ['title', 'location', 'category', 'severity', 'description']