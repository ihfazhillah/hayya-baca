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
    path(
        "english/weakpoints/",
        views.WeakPointListView.as_view(),
        name="english-weakpoints",
    ),
    path(
        "english/weakpoints/record/",
        views.WeakPointRecordView.as_view(),
        name="english-weakpoints-record",
    ),
    path("english/streak/", views.StreakView.as_view(), name="english-streak"),
    path(
        "english/streak/ping/",
        views.StreakPingView.as_view(),
        name="english-streak-ping",
    ),
]
