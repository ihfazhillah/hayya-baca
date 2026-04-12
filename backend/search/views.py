from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess
from library.models import Book
from reading.models import ReadingLog

from .models import SearchLog, SearchSuggestion
from .serializers import (
    SearchLogCreateSerializer,
    SearchResultSerializer,
    SuggestionSerializer,
)


MAX_RESULTS = 30
MAX_SUGGEST = 8
TOP_POPULAR = 5


def _score(title: str, categories, q: str, already_read: bool) -> int:
    t = (title or "").lower()
    ql = q.lower()
    score = 0
    if t == ql:
        score += 100
    elif t.startswith(ql):
        score += 50
    elif ql in t:
        score += 25
    if any(ql in (c or "").lower() for c in (categories or [])):
        score += 10
    if already_read:
        score += 5
    return score


def _read_slugs_for_child(child_id: int) -> set[str]:
    return set(
        ReadingLog.objects.filter(child_id=child_id).values_list(
            "book_id", flat=True
        )
    )


def _cover_url(book: Book, request) -> str | None:
    if not book.cover:
        return None
    try:
        return request.build_absolute_uri(book.cover.url)
    except Exception:
        return None


class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if not q:
            return Response({"results": [], "total": 0})

        child_id_raw = request.query_params.get("child_id")
        child_id: int | None = None
        if child_id_raw:
            try:
                child_id = int(child_id_raw)
            except (TypeError, ValueError):
                child_id = None
            if child_id is not None and not ChildAccess.objects.filter(
                user=request.user, child_id=child_id
            ).exists():
                child_id = None

        read_slugs = _read_slugs_for_child(child_id) if child_id else set()

        qs = Book.objects.filter(is_published=True).filter(
            Q(title__icontains=q) | Q(categories__icontains=q)
        )

        results = []
        for b in qs:
            already_read = b.slug in read_slugs
            score = _score(b.title, b.categories, q, already_read)
            if score <= 0:
                continue
            results.append(
                {
                    "slug": b.slug,
                    "type": b.content_type,
                    "title": b.title,
                    "categories": b.categories or [],
                    "cover_url": _cover_url(b, request),
                    "already_read": already_read,
                    "score": score,
                    "_updated_at": b.updated_at,
                }
            )

        results.sort(key=lambda r: (-r["score"], -r["_updated_at"].timestamp()))
        results = results[:MAX_RESULTS]
        for r in results:
            r.pop("_updated_at", None)

        data = SearchResultSerializer(results, many=True).data
        return Response({"results": data, "total": len(data)})


class SuggestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip().lower()
        if not q:
            qs = SearchSuggestion.objects.filter(
                source=SearchSuggestion.SOURCE_USER
            ).order_by("-weight")[:TOP_POPULAR]
        else:
            qs = SearchSuggestion.objects.filter(
                phrase__istartswith=q
            ).order_by("-weight")[:MAX_SUGGEST]
        data = SuggestionSerializer(
            [{"phrase": s.phrase, "source": s.source} for s in qs], many=True
        ).data
        return Response({"suggestions": data})


class SearchLogCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        child_id = request.data.get("child_id")
        if child_id is None:
            return Response(
                {"detail": "child_id required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not ChildAccess.objects.filter(
            user=request.user, child_id=child_id
        ).exists():
            return Response(
                {"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = SearchLogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        SearchLog.objects.create(
            child_id=child_id,
            query=serializer.validated_data["query"],
            result_slug=serializer.validated_data["result_slug"],
            result_type=serializer.validated_data["result_type"],
        )
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
