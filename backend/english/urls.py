from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"english/lessons", views.EnglishLessonViewSet, basename="english-lesson")

urlpatterns = router.urls + [
    path("english/transcribe/", views.TranscribeView.as_view(), name="english-transcribe"),
]
