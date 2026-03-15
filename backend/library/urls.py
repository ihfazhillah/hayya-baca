from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .quiz_manage import (
    ApplyView, ExportView, PublishView,
    BookListView, BookQuizzesView, BookExportView, BookImportView,
    QuizDetailView,
)

router = DefaultRouter()
router.register(r"books", views.BookViewSet, basename="book")

urlpatterns = router.urls + [
    # Bulk flow (existing)
    path("quiz-manage/export/", ExportView.as_view(), name="quiz-export"),
    path("quiz-manage/apply/", ApplyView.as_view(), name="quiz-apply"),
    path("quiz-manage/publish/", PublishView.as_view(), name="quiz-publish"),
    # Book-centric
    path("quiz-manage/books/", BookListView.as_view(), name="quiz-book-list"),
    path("quiz-manage/books/<int:book_id>/quizzes/", BookQuizzesView.as_view(), name="quiz-book-quizzes"),
    path("quiz-manage/books/<int:book_id>/export/", BookExportView.as_view(), name="quiz-book-export"),
    path("quiz-manage/books/<int:book_id>/import/", BookImportView.as_view(), name="quiz-book-import"),
    path("quiz-manage/quizzes/<int:quiz_id>/", QuizDetailView.as_view(), name="quiz-detail"),
]
