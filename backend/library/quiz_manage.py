"""
Quiz Management API views.

Endpoints for exporting content, importing generated quizzes,
reviewing them, and applying to the database + static JSON files.
All endpoints require staff login (shared Django session auth).
"""

import json
from pathlib import Path

from django.conf import settings
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


class ImportView(StaffRequiredMixin, View):
    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        if not isinstance(data, list):
            return JsonResponse({"error": "Expected a list"}, status=400)

        book_ids = [item["book_id"] for item in data]
        existing = set(Book.objects.filter(id__in=book_ids).values_list("id", flat=True))
        missing = [bid for bid in book_ids if bid not in existing]
        if missing:
            return JsonResponse({"error": f"Books not found: {missing}"}, status=400)

        request.session["pending_quizzes"] = data
        total_q = sum(len(item.get("quizzes", [])) for item in data)
        return JsonResponse({
            "status": "ok",
            "books": len(data),
            "total_questions": total_q,
        })


class PendingView(StaffRequiredMixin, View):
    def get(self, request):
        pending = request.session.get("pending_quizzes", [])
        book_ids = [item["book_id"] for item in pending]
        books = {b.id: b for b in Book.objects.filter(id__in=book_ids)}
        result = []
        for item in pending:
            book = books.get(item["book_id"])
            result.append({
                "book_id": item["book_id"],
                "title": book.title if book else "?",
                "content_type": book.content_type if book else "?",
                "existing_quiz_count": Quiz.objects.filter(book_id=item["book_id"]).count() if book else 0,
                "quizzes": item.get("quizzes", []),
            })
        return JsonResponse(result, safe=False)


class ClearPendingView(StaffRequiredMixin, View):
    def post(self, request):
        request.session.pop("pending_quizzes", None)
        return JsonResponse({"status": "ok"})


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


class ApplyView(StaffRequiredMixin, View):
    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        mode = data.get("mode", "append")
        items = data.get("items", [])
        stats = {"created": 0, "deleted": 0, "books": 0}

        for item in items:
            book_id = item["book_id"]
            try:
                book = Book.objects.get(id=book_id)
            except Book.DoesNotExist:
                continue

            if mode == "clean":
                deleted, _ = Quiz.objects.filter(book=book).delete()
                stats["deleted"] += deleted
                start_order = 1
            else:
                max_order = (
                    Quiz.objects.filter(book=book)
                    .order_by("-order")
                    .values_list("order", flat=True)
                    .first()
                )
                start_order = (max_order or 0) + 1

            for i, q in enumerate(item.get("quizzes", [])):
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

            if book.content_type == "article":
                _sync_article_json(book)
            else:
                _sync_book_json(book)

            stats["books"] += 1

        request.session.pop("pending_quizzes", None)
        return JsonResponse({"status": "ok", **stats})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class QuizManagerPageView(StaffRequiredMixin, View):
    def get(self, request):
        from django.shortcuts import render
        return render(request, "library/quiz_manager.html")
