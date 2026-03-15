from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .quiz_manage import ApplyView, ExportView, PublishView

router = DefaultRouter()
router.register(r"books", views.BookViewSet, basename="book")

urlpatterns = router.urls + [
    path("quiz-manage/export/", ExportView.as_view(), name="quiz-export"),
    path("quiz-manage/apply/", ApplyView.as_view(), name="quiz-apply"),
    path("quiz-manage/publish/", PublishView.as_view(), name="quiz-publish"),
]
