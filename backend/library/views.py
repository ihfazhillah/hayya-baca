from django.db import connection
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess
from .models import Book, Bookmark
from .serializers import BookDetailSerializer, BookListSerializer, BookmarkSerializer


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Book.objects.filter(is_published=True).annotate(quiz_count=Count("quizzes"))
        content_type = self.request.query_params.get("type")
        if content_type:
            qs = qs.filter(content_type=content_type)
        category = self.request.query_params.get("category")
        if category:
            if connection.vendor == "sqlite":
                # SQLite doesn't support __contains on JSON; filter in Python
                pks = [b.pk for b in qs if category in (b.categories or [])]
                qs = qs.filter(pk__in=pks)
            else:
                qs = qs.filter(categories__contains=[category])
        min_age = self.request.query_params.get("min_age")
        if min_age is not None:
            qs = qs.filter(min_age__lte=int(min_age))
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BookDetailSerializer
        return BookListSerializer


def _user_has_child(user, child_pk: int) -> bool:
    return ChildAccess.objects.filter(user=user, child_id=child_pk).exists()


class BookmarkPushView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, child_pk):
        if not _user_has_child(request.user, child_pk):
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        child = get_object_or_404(Child, pk=child_pk)
        entries = request.data.get("bookmarks", [])
        if not isinstance(entries, list):
            return Response({"detail": "bookmarks must be list"}, status=400)

        applied = 0
        for entry in entries:
            ct = entry.get("content_type")
            slug = entry.get("content_slug")
            is_deleted = bool(entry.get("is_deleted", False))
            if ct not in (Bookmark.CONTENT_BOOK, Bookmark.CONTENT_ARTICLE) or not slug:
                continue
            existing = Bookmark.objects.filter(
                child=child, content_type=ct, content_slug=slug
            ).first()
            client_ts = entry.get("updated_at")
            if existing:
                if client_ts and existing.updated_at.isoformat() > str(client_ts):
                    continue  # server newer — skip
                existing.is_deleted = is_deleted
                existing.save()
            else:
                Bookmark.objects.create(
                    child=child,
                    content_type=ct,
                    content_slug=slug,
                    is_deleted=is_deleted,
                )
            applied += 1
        return Response({"applied": applied})


class BookmarkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, child_pk):
        if not _user_has_child(request.user, child_pk):
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        qs = Bookmark.objects.filter(child_id=child_pk, is_deleted=False).order_by(
            "-updated_at"
        )
        return Response(BookmarkSerializer(qs, many=True).data)
