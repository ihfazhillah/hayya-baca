"""
Quiz Management API views.

Endpoints for exporting content, importing generated quizzes,
reviewing them, and applying to the database + static JSON files.
All endpoints require staff login (shared Django session auth).
"""

import json
from pathlib import Path

from django.conf import settings
from django.db.models import Count
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.contrib.auth.mixins import LoginRequiredMixin

from .models import Book, BookPage, ArticleSection, Quiz


class StaffRequiredMixin(LoginRequiredMixin):
    login_url = "/admin/login/"

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            from django.shortcuts import redirect
            return redirect(f"{self.login_url}?next={request.path}")
        if not request.user.is_staff:
            return JsonResponse({"error": "Staff login required"}, status=403)
        return super().dispatch(request, *args, **kwargs)


def _book_content_string(book):
    if book.content_type == "article":
        sections = ArticleSection.objects.filter(book=book).order_by("order")
        parts = []
        for s in sections:
            if s.type == "list":
                parts.append("\n".join(s.items))
            else:
                parts.append(s.text)
        return "\n\n".join(parts)
    else:
        pages = BookPage.objects.filter(book=book).order_by("page")
        return "\n\n".join(p.text for p in pages)


def _existing_quizzes(book):
    return list(
        Quiz.objects.filter(book=book)
        .order_by("order")
        .values("id", "order", "type", "question", "options", "answer", "explanation")
    )


def _sync_json(book):
    """Sync quiz data to the appropriate JSON file (article or book)."""
    if book.content_type == "article":
        _sync_article_json(book)
    else:
        _sync_book_json(book)


def _sync_article_json(book):
    articles_dir = Path(settings.BASE_DIR).parent / "content" / "articles"
    if not articles_dir.exists():
        return

    target = None
    for f in articles_dir.iterdir():
        if f.name.startswith(f"{book.id}-") and f.suffix == ".json":
            target = f
            break

    if not target:
        return

    with open(target, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    quizzes = Quiz.objects.filter(book=book).order_by("order")
    data["quiz"] = []
    for q in quizzes:
        entry = {
            "type": q.type,
            "question": q.question,
            "answer": q.answer,
            "explanation": q.explanation,
        }
        if q.type == "multiple_choice" and q.options:
            entry["options"] = q.options
        data["quiz"].append(entry)

    with open(target, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def _sync_book_json(book):
    published = Path(settings.BASE_DIR) / "media" / "published" / "books" / f"{book.id}.json"
    if not published.exists():
        return

    with open(published, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    quizzes = Quiz.objects.filter(book=book).order_by("order")
    data["quiz"] = []
    for q in quizzes:
        entry = {
            "type": q.type,
            "question": q.question,
            "answer": q.answer,
            "explanation": q.explanation,
        }
        if q.type == "multiple_choice" and q.options:
            entry["options"] = q.options
        data["quiz"].append(entry)

    with open(published, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def _apply_quizzes(book, quizzes, mode):
    """Apply quizzes to a book. Returns {"created": N, "deleted": N}."""
    stats = {"created": 0, "deleted": 0}

    if mode == "clean":
        deleted, _ = Quiz.objects.filter(book=book).delete()
        stats["deleted"] = deleted
        start_order = 1
    else:
        max_order = (
            Quiz.objects.filter(book=book)
            .order_by("-order")
            .values_list("order", flat=True)
            .first()
        )
        start_order = (max_order or 0) + 1

    for i, q in enumerate(quizzes):
        Quiz.objects.create(
            book=book,
            order=start_order + i,
            type=q["type"],
            question=q["question"],
            options=q.get("options", []),
            answer=q["answer"],
            explanation=q.get("explanation", ""),
        )
        stats["created"] += 1

    _sync_json(book)
    return stats


class ExportView(StaffRequiredMixin, View):
    def get(self, request):
        content_type = request.GET.get("type")
        qs = Book.objects.all()
        if content_type:
            qs = qs.filter(content_type=content_type)

        result = []
        for book in qs:
            result.append({
                "id": book.id,
                "slug": book.slug,
                "title": book.title,
                "content_type": book.content_type,
                "content": _book_content_string(book),
                "existing_quizzes": _existing_quizzes(book),
            })
        return JsonResponse(result, safe=False)


class ApplyView(StaffRequiredMixin, View):
    """POST /api/quiz-manage/apply/ — apply accepted quizzes directly.

    Body: { "mode": "clean"|"append", "items": [{ "book_id": N, "quizzes": [...] }] }
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        mode = data.get("mode", "append")
        items = data.get("items", [])
        stats = {"created": 0, "deleted": 0, "books": 0}

        for item in items:
            book_id = item.get("book_id") or item.get("id")
            try:
                book = Book.objects.get(id=book_id)
            except Book.DoesNotExist:
                continue

            quizzes = item.get("quizzes") or item.get("existing_quizzes") or []
            result = _apply_quizzes(book, quizzes, mode)
            stats["created"] += result["created"]
            stats["deleted"] += result["deleted"]
            stats["books"] += 1

        return JsonResponse({"status": "ok", **stats})


class PublishView(StaffRequiredMixin, View):
    """POST /api/quiz-manage/publish/ — run publish command."""

    def post(self, request):
        from django.core.management import call_command
        from io import StringIO

        try:
            data = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            data = {}

        out = StringIO()
        book_ids = data.get("book_ids")

        if book_ids:
            call_command("publish", ids=book_ids, stdout=out)
        else:
            call_command("publish", all=True, force=data.get("force", False), stdout=out)

        return JsonResponse({"status": "ok", "output": out.getvalue()})


# --- New book-centric endpoints ---


class BookListView(StaffRequiredMixin, View):
    """GET /api/quiz-manage/books/ — list books with quiz counts."""

    def get(self, request):
        qs = Book.objects.annotate(quiz_count=Count("quizzes"))
        content_type = request.GET.get("type")
        if content_type:
            qs = qs.filter(content_type=content_type)
        qs = qs.order_by("content_type", "title")

        result = [
            {
                "id": b.id,
                "title": b.title,
                "content_type": b.content_type,
                "quiz_count": b.quiz_count,
            }
            for b in qs
        ]
        return JsonResponse(result, safe=False)


class BookQuizzesView(StaffRequiredMixin, View):
    """GET /api/quiz-manage/books/<id>/quizzes/ — quizzes for one book."""

    def get(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return JsonResponse({"error": "Book not found"}, status=404)

        quizzes = _existing_quizzes(book)
        return JsonResponse({
            "book_id": book.id,
            "title": book.title,
            "content_type": book.content_type,
            "quizzes": quizzes,
        })


class BookExportView(StaffRequiredMixin, View):
    """GET /api/quiz-manage/books/<id>/export/ — export one book for AI."""

    def get(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return JsonResponse({"error": "Book not found"}, status=404)

        result = {
            "id": book.id,
            "slug": book.slug,
            "title": book.title,
            "content_type": book.content_type,
            "content": _book_content_string(book),
            "existing_quizzes": _existing_quizzes(book),
        }
        return JsonResponse(result)


class BookImportView(StaffRequiredMixin, View):
    """POST /api/quiz-manage/books/<id>/import/ — import quizzes to one book."""

    def post(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return JsonResponse({"error": "Book not found"}, status=404)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        mode = data.get("mode", "append")
        quizzes = data.get("quizzes", [])
        if not quizzes:
            return JsonResponse({"error": "No quizzes provided"}, status=400)

        result = _apply_quizzes(book, quizzes, mode)
        return JsonResponse({"status": "ok", "book_id": book.id, **result})


class QuizDetailView(StaffRequiredMixin, View):
    """PUT/DELETE /api/quiz-manage/quizzes/<id>/"""

    def put(self, request, quiz_id):
        try:
            quiz = Quiz.objects.select_related("book").get(id=quiz_id)
        except Quiz.DoesNotExist:
            return JsonResponse({"error": "Quiz not found"}, status=404)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        for field in ("type", "question", "options", "answer", "explanation"):
            if field in data:
                setattr(quiz, field, data[field])
        quiz.save()

        _sync_json(quiz.book)
        return JsonResponse({"status": "ok", "id": quiz.id})

    def delete(self, request, quiz_id):
        try:
            quiz = Quiz.objects.select_related("book").get(id=quiz_id)
        except Quiz.DoesNotExist:
            return JsonResponse({"error": "Quiz not found"}, status=404)

        book = quiz.book
        quiz.delete()
        _sync_json(book)
        return JsonResponse({"status": "ok"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class QuizManagerPageView(StaffRequiredMixin, View):
    def get(self, request):
        from django.shortcuts import render
        return render(request, "library/quiz_manager.html")
