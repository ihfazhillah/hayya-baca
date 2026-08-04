from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EnglishLesson
from .transcribe import SttUnavailable, transcribe_bytes
from .serializers import (
    EnglishLessonDetailSerializer,
    EnglishLessonListSerializer,
)


class EnglishLessonViewSet(viewsets.ReadOnlyModelViewSet):
    """Published English (AU accent) practice lessons.

    Query params:
      level  — beginner | intermediate | advanced
      source — custom | youtube
    """

    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = EnglishLesson.objects.filter(is_published=True).annotate(
            segment_count=Count("segments")
        )
        level = self.request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EnglishLessonDetailSerializer
        return EnglishLessonListSerializer


class TranscribeView(APIView):
    """POST multipart {audio: <file>} -> {"transcript": "..."}

    Dipakai halaman speaking/shadowing (web & mobile). Audio pendek saja
    (satu kalimat/segmen); dibatasi 10 MB.
    """

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser]

    MAX_BYTES = 10 * 1024 * 1024

    def post(self, request):
        upload = request.FILES.get("audio")
        if upload is None:
            return Response(
                {"detail": "Field 'audio' wajib diisi"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > self.MAX_BYTES:
            return Response(
                {"detail": "Audio terlalu besar (maks 10 MB)"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        try:
            transcript = transcribe_bytes(upload.read())
        except SttUnavailable as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception:
            return Response(
                {"detail": "Gagal memproses audio"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response({"transcript": transcript})
