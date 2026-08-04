import json
import logging
import sys

from django.conf import settings
from django.db.models import Count
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db import transaction
from django.utils import timezone

from .models import EnglishLesson, EnglishSegment, EnglishStreak, EnglishWeakPoint
from .signing import unsign_segment
from .transcribe import SttUnavailable, transcribe_bytes
from .serializers import (
    EnglishLessonCreateSerializer,
    EnglishLessonDetailSerializer,
    EnglishLessonListSerializer,
    EnglishLessonUpdateSerializer,
    EnglishStreakSerializer,
    EnglishWeakPointSerializer,
)

# Fitness Lidah thresholds (Spec 066): a sound enters the drill queue after
# WEAKPOINT_ACTIVATE_N fails, and leaves it after WEAKPOINT_CLEAR_M clean passes.
WEAKPOINT_ACTIVATE_N = 3
WEAKPOINT_CLEAR_M = 3


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
            result = transcribe_bytes(upload.read())
        except SttUnavailable as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception:
            return Response(
                {"detail": "Gagal memproses audio"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(
            {"transcript": result["text"], "words": result["words"]}
        )


class WeakPointListView(APIView):
    """GET → the caller's ACTIVE weak sounds (the Fitness Lidah drill queue)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = EnglishWeakPoint.objects.filter(
            owner=request.user, status=EnglishWeakPoint.Status.ACTIVE
        )
        return Response(EnglishWeakPointSerializer(qs, many=True).data)


class WeakPointRecordView(APIView):
    """POST [{phoneme, fail, pass}] → apply per-attempt deltas + threshold logic.

    The frontend maps mis-said words → target phonemes; the queue lives here so
    it stays authoritative and per-account.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        deltas = request.data
        if not isinstance(deltas, list):
            return Response(
                {"detail": "Body harus berupa list delta"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        S = EnglishWeakPoint.Status
        updated = []
        with transaction.atomic():
            for d in deltas:
                if not isinstance(d, dict):
                    continue
                phoneme = str(d.get("phoneme", "")).strip()[:8]
                if not phoneme:
                    continue
                try:
                    fail = max(0, int(d.get("fail", 0) or 0))
                    passes = max(0, int(d.get("pass", 0) or 0))
                except (TypeError, ValueError):
                    continue
                if fail == 0 and passes == 0:
                    continue
                wp, _ = EnglishWeakPoint.objects.get_or_create(
                    owner=request.user, phoneme=phoneme
                )
                if fail > 0:
                    wp.fail_count += fail
                    wp.pass_streak = 0
                elif passes > 0:
                    wp.pass_streak += passes
                wp.total_attempts += 1
                if wp.fail_count >= WEAKPOINT_ACTIVATE_N:
                    wp.status = S.ACTIVE
                if wp.status == S.ACTIVE and wp.pass_streak >= WEAKPOINT_CLEAR_M:
                    wp.status = S.CLEARED
                    wp.fail_count = 0
                    wp.pass_streak = 0
                wp.save()
                updated.append(wp)
        return Response(EnglishWeakPointSerializer(updated, many=True).data)


class StreakView(APIView):
    """GET current English daily streak (Spec 068)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        streak, _ = EnglishStreak.objects.get_or_create(owner=request.user)
        return Response(EnglishStreakSerializer(streak).data)


class StreakPingView(APIView):
    """POST → register today's practice; returns the updated streak."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        with transaction.atomic():
            streak, _ = EnglishStreak.objects.select_for_update().get_or_create(
                owner=request.user
            )
            streak.register_practice(timezone.localdate())
            streak.save()
        return Response(EnglishStreakSerializer(streak).data)


# --- Wide-event ingest (observability) -------------------------------------
_event_logger = logging.getLogger("english.events")
if not _event_logger.handlers:
    _h = logging.StreamHandler(sys.stderr)
    _h.setFormatter(logging.Formatter("ENGLISH_EVENT %(message)s"))
    _event_logger.addHandler(_h)
    _event_logger.setLevel(logging.INFO)
    _event_logger.propagate = False


class EventIngestView(APIView):
    """One wide structured event per browser attempt → server logs.

    Read them with: journalctl -u hayyabaca -g ENGLISH_EVENT
    Debug aid for the STT pipeline (Spec 065); tail-sample later if noisy.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {"raw": request.data}
        data["user"] = request.user.username
        try:
            _event_logger.info(json.dumps(data, default=str)[:6000])
        except Exception:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)
