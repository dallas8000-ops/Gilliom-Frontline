from django.urls import path

from . import views

urlpatterns = [
    path('incidents/', views.incidents_list, name='incidents_list'),
    path('incidents/<str:case_id>/notes/', views.add_note, name='add_note'),
    path('incidents/<str:case_id>/status/', views.set_status, name='set_status'),
    path('parse/', views.ai_parse, name='ai_parse'),
]