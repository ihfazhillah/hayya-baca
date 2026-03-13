from django.db.models import Count
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import Book
from .serializers import BookDetailSerializer, BookListSerializer


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Book.objects.filter(is_published=True).annotate(quiz_count=Count("quizzes"))
        content_type = self.request.query_params.get("type")
        if content_type:
            qs = qs.filter(content_type=content_type)
        category = self.request.query_params.get("category")
        if category:
            from django.db import connection
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
