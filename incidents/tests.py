from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import CustodyLogEntry, Incident


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