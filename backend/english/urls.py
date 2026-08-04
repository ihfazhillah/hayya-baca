from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"english/lessons", views.EnglishLessonViewSet, basename="english-lesson")

urlpatterns = router.urls + [
    path(
        "english/segments/<int:pk>/audio/",
        views.SegmentAudioView.as_view(),
        name="english-segment-audio",
    ),
    path("english/transcribe/", views.TranscribeView.as_view(), name="english-transcribe"),
]
