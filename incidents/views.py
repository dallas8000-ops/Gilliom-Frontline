import json

import requests
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import redirect, render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import CustodyLogEntry, Incident
from .serializers import IncidentCreateSerializer, IncidentSerializer


def _broadcast(event_type, payload):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        'incidents',
        {'type': 'incident.event', 'event': event_type, 'payload': payload},
    )


@login_required
def index(request):
    return render(request, 'react_index.html', {'username': request.user.get_username()})


def signup(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('index')
    else:
        form = UserCreationForm()
    return render(request, 'registration/signup.html', {'form': form})


@api_view(['GET', 'POST'])
def incidents_list(request):
    if request.method == 'GET':
        queryset = Incident.objects.select_related('reported_by').prefetch_related(
            'log_entries__author'
        )
        return Response(IncidentSerializer(queryset, many=True).data)

    serializer = IncidentCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    incident = serializer.save(reported_by=request.user)
    CustodyLogEntry.objects.create(
        incident=incident,
        text=f'Incident filed by {request.user.get_username()}',
        author=request.user,
    )
    full = IncidentSerializer(incident).data
    _broadcast('incident_created', full)
    return Response(full, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def add_note(request, case_id):
    try:
        incident = Incident.objects.get(case_id=case_id)
    except Incident.DoesNotExist:
        return Response({'error': 'Incident not found'}, status=404)

    text = (request.data.get('text') or '').strip()
    if not text:
        return Response({'error': 'Note text required'}, status=400)

    CustodyLogEntry.objects.create(incident=incident, text=text, author=request.user)
    full = IncidentSerializer(incident).data
    _broadcast('incident_updated', full)
    return Response(full)


@api_view(['PATCH'])
def set_status(request, case_id):
    try:
        incident = Incident.objects.get(case_id=case_id)
    except Incident.DoesNotExist:
        return Response({'error': 'Incident not found'}, status=404)

    new_status = request.data.get('status')
    if new_status not in ('open', 'closed'):
        return Response({'error': 'Invalid status'}, status=400)

    incident.status = new_status
    incident.save(update_fields=['status'])
    CustodyLogEntry.objects.create(
        incident=incident,
        text='Case marked closed' if new_status == 'closed' else 'Case reopened',
        author=request.user,
    )
    full = IncidentSerializer(incident).data
    _broadcast('incident_updated', full)
    return Response(full)


@api_view(['POST'])
def ai_parse(request):
    raw_text = (request.data.get('rawText') or '').strip()
    if not raw_text:
        return Response({'error': 'rawText required'}, status=400)
    if not settings.OPENAI_API_KEY:
        return Response({'error': 'AI intake not configured. Set OPENAI_API_KEY.'}, status=501)

    prompt = (
        'Extract structured incident-report fields from this raw field report. '
        'Return ONLY valid JSON with these exact keys: title (short, under 10 words), '
        'location, category (one of: "Security breach", "Theft / loss", "Access control", '
        '"Safety / injury", "Equipment fault", "Other"), severity (one of: "low", "medium", '
        '"high"), description (cleaned up, 2-4 sentences).\n\n'
        f'Raw report:\n"""{raw_text}"""'
    )

    try:
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {settings.OPENAI_API_KEY}',
            },
            json={
                'model': 'gpt-4o-mini',
                'messages': [{'role': 'user', 'content': prompt}],
                'response_format': {'type': 'json_object'},
                'temperature': 0.2,
            },
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        return Response(json.loads(content))
    except (requests.RequestException, KeyError, TypeError, json.JSONDecodeError):
        return Response({'error': 'AI parsing failed'}, status=502)