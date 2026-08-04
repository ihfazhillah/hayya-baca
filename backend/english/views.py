from django.conf import settings
from django.db.models import Count
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EnglishLesson, EnglishSegment
from .signing import unsign_segment
from .transcribe import SttUnavailable, transcribe_bytes
from .serializers import (
    EnglishLessonCreateSerializer,
    EnglishLessonDetailSerializer,
    EnglishLessonListSerializer,
    EnglishLessonUpdateSerializer,
)


class EnglishLessonViewSet(viewsets.ModelViewSet):
    """English (AU accent) practice lessons.

    Read: lessons visible to the caller (own ∪ public-ready ∪ admin-published).
    Write: create (owner=caller) / patch / delete are owner-only.

    Query params (list): level, source.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EnglishLesson.objects.annotate(segment_count=Count("segments"))
        # Writes only ever touch the caller's own lessons → non-owner gets 404.
        if self.action in ("update", "partial_update", "destroy"):
            return qs.filter(owner=self.request.user)
        qs = qs.visible_to(self.request.user)
        level = self.request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return EnglishLessonCreateSerializer
        if self.action in ("update", "partial_update"):
            return EnglishLessonUpdateSerializer
        if self.action == "retrieve":
            return EnglishLessonDetailSerializer
        return EnglishLessonListSerializer


class SegmentAudioView(APIView):
    """Stream one segment's mp3, access-controlled (Spec 064).

    Allowed when the caller is authenticated and may see the parent lesson, OR
    when a valid short-lived `?t=` signature for this segment is presented (so
    <audio>/expo-av, which can't send an Authorization header, can play it).
    In prod (ENGLISH_USE_X_ACCEL) hands off to nginx via X-Accel-Redirect.
    """

    permission_classes = [AllowAny]

    def get(self, request, pk):
        seg = get_object_or_404(EnglishSegment, pk=pk)

        allowed = False
        if request.user.is_authenticated:
            allowed = (
                EnglishLesson.objects.visible_to(request.user)
                .filter(pk=seg.lesson_id)
                .exists()
            )
        if not allowed:
            token = request.query_params.get("t")
            if token and unsign_segment(token) == seg.id:
                allowed = True
        if not allowed or not seg.audio:
            raise Http404

        if getattr(settings, "ENGLISH_USE_X_ACCEL", False):
            resp = HttpResponse(content_type="audio/mpeg")
            resp["X-Accel-Redirect"] = f"/protected-english-media/{seg.audio.name}"
            return resp
        return FileResponse(seg.audio.open("rb"), content_type="audio/mpeg")


class TranscribeView(APIView):
    """POST multipart {audio: <file>} -> {"transcript": "..."}

    Dipakai halaman speaking/shadowing (web & mobile). Audio pendek saja
    (satu kalimat/segmen); dibatasi 10 MB.
    """

    permission_classes = [IsAuthenticated]
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
