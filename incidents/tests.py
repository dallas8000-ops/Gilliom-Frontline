from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import CustodyLogEntry, Incident


@override_settings(STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage')
class IncidentWorkflowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='dba-smoke',
            password='test-password-42',
        )
        self.client.force_login(self.user)

    def test_authenticated_incident_workflow(self):
        page = self.client.get(reverse('index'))
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, 'Gilliom FrontLine')

        created = self.client.post(
            reverse('incidents_list'),
            data={
                'title': 'Gate access failure',
                'location': 'North gate',
                'category': 'Access control',
                'severity': 'high',
                'description': 'The badge reader stopped accepting authorized badges.',
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201)
        case_id = created.json()['case_id']
        self.assertTrue(case_id.startswith('FL-'))
        self.assertEqual(Incident.objects.count(), 1)
        self.assertEqual(CustodyLogEntry.objects.count(), 1)

        note = self.client.post(
            reverse('add_note', args=[case_id]),
            data={'text': 'Reader isolated for inspection.'},
            content_type='application/json',
        )
        self.assertEqual(note.status_code, 200)
        self.assertEqual(len(note.json()['log']), 2)

        closed = self.client.patch(
            reverse('set_status', args=[case_id]),
            data={'status': 'closed'},
            content_type='application/json',
        )
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.json()['status'], 'closed')
        self.assertEqual(CustodyLogEntry.objects.count(), 3)

        logout = self.client.post(reverse('logout'))
        self.assertRedirects(logout, reverse('login'))
        self.assertRedirects(self.client.get(reverse('index')), f'{reverse("login")}?next=/')


class IncidentValidationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='dba-validate',
            password='test-password-42',
        )

    def _create_incident(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('incidents_list'),
            data={
                'title': 'Fence breach',
                'location': 'South perimeter',
                'category': 'Security breach',
                'severity': 'high',
                'description': 'Individual observed cutting through the fence line.',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        return response.json()['case_id']

    def test_unauthenticated_requests_are_rejected(self):
        list_response = self.client.get(reverse('incidents_list'))
        self.assertIn(list_response.status_code, (401, 403))

        create_response = self.client.post(
            reverse('incidents_list'),
            data={
                'title': 'Should not be created',
                'location': 'Nowhere',
                'category': 'Other',
                'severity': 'low',
                'description': 'This request has no authenticated session.',
            },
            content_type='application/json',
        )
        self.assertIn(create_response.status_code, (401, 403))
        self.assertEqual(Incident.objects.count(), 0)

    def test_create_incident_rejects_missing_required_fields(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('incidents_list'),
            data={'title': 'Missing everything else'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Incident.objects.count(), 0)

    def test_add_note_rejects_empty_text(self):
        case_id = self._create_incident()
        response = self.client.post(
            reverse('add_note', args=[case_id]),
            data={'text': '   '},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_add_note_on_unknown_case_returns_404(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('add_note', args=['FL-2026-9999']),
            data={'text': 'This case does not exist.'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_set_status_rejects_invalid_value(self):
        case_id = self._create_incident()
        response = self.client.patch(
            reverse('set_status', args=[case_id]),
            data={'status': 'archived'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_set_status_on_unknown_case_returns_404(self):
        self.client.force_login(self.user)
        response = self.client.patch(
            reverse('set_status', args=['FL-2026-9999']),
            data={'status': 'closed'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_closing_an_already_closed_case_is_rejected(self):
        case_id = self._create_incident()
        self.client.patch(
            reverse('set_status', args=[case_id]),
            data={'status': 'closed'},
            content_type='application/json',
        )
        second_close = self.client.patch(
            reverse('set_status', args=[case_id]),
            data={'status': 'closed'},
            content_type='application/json',
        )
        self.assertEqual(second_close.status_code, 400)
        self.assertEqual(second_close.json()['error'], 'Case is already closed')
        self.assertEqual(CustodyLogEntry.objects.count(), 2)

    def test_ai_parse_rejects_empty_raw_text(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('ai_parse'),
            data={'rawText': ''},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_ai_parse_without_api_key_returns_not_implemented(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('ai_parse'),
            data={'rawText': 'guard reported someone at the gate around 2am'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 501)