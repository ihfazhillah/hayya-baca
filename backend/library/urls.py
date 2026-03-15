from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .quiz_manage import (
    ApplyView,
    ClearPendingView,
    ExportView,
    ImportView,
    PendingView,
)

router = DefaultRouter()
router.register(r"books", views.BookViewSet, basename="book")

urlpatterns = router.urls + [
    path("quiz-manage/export/", ExportView.as_view(), name="quiz-export"),
    path("quiz-manage/import/", ImportView.as_view(), name="quiz-import"),
    path("quiz-manage/pending/", PendingView.as_view(), name="quiz-pending"),
    path("quiz-manage/apply/", ApplyView.as_view(), name="quiz-apply"),
    path("quiz-manage/clear/", ClearPendingView.as_view(), name="quiz-clear"),
]
