from django.conf import settings
from django.db import models
from django.utils import timezone


class Incident(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]
    CATEGORY_CHOICES = [
        ('Security breach', 'Security breach'),
        ('Theft / loss', 'Theft / loss'),
        ('Access control', 'Access control'),
        ('Safety / injury', 'Safety / injury'),
        ('Equipment fault', 'Equipment fault'),
        ('Other', 'Other'),
    ]

    case_id = models.CharField(max_length=32, unique=True, editable=False)
    title = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    category = models.CharField(max_length=64, choices=CATEGORY_CHOICES, default='Other')
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default='medium')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='open')
    description = models.TextField()
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='filed_incidents',
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.case_id:
            year = timezone.now().year
            prefix = f'FL-{year}-'
            last = Incident.objects.filter(case_id__startswith=prefix).order_by('-case_id').first()
            next_num = 1
            if last:
                try:
                    next_num = int(last.case_id.replace(prefix, '')) + 1
                except ValueError:
                    pass
            self.case_id = f'{prefix}{next_num:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.case_id} - {self.title}'


class CustodyLogEntry(models.Model):
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='log_entries')
    text = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='custody_entries',
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.incident.case_id}: {self.text[:40]}'