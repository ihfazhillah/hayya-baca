from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

progress_router = DefaultRouter()
progress_router.register(r"progress", views.ReadingProgressViewSet, basename="progress")

quiz_router = DefaultRouter()
quiz_router.register(r"quiz-attempts", views.QuizAttemptViewSet, basename="quiz-attempt")

# These are nested under children/<child_pk>/ in config/urls.py
urlpatterns = progress_router.urls + quiz_router.urls
