import re

from rest_framework import serializers

from .models import (
    EnglishLesson,
    EnglishSegment,
    EnglishStreak,
    EnglishWeakPoint,
    EnglishWordPractice,
)
from .signing import sign_segment

MAX_TEXT_CHARS = 5000
MAX_SEGMENTS = 60


def split_sentences(text: str) -> list[str]:
    """Split a block of English text into sentence-sized segments.

    Ported from tools/english-pipeline/make_lesson.py so web-created lessons
    segment identically to pipeline-imported ones.
    """
    parts = re.split(r"(?<=[.!?])\s+", text.replace("\n", " "))
    return [p.strip() for p in parts if p.strip()]


class EnglishSegmentSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = EnglishSegment
        fields = ["id", "order", "text", "audio_url", "duration_s"]

    def get_audio_url(self, obj) -> str | None:
        if not obj.audio:
            return None
        request = self.context.get("request")
        path = f"/api/english/segments/{obj.id}/audio/?t={sign_segment(obj.id)}"
        return request.build_absolute_uri(path) if request else path


class EnglishLessonListSerializer(serializers.ModelSerializer):
    segment_count = serializers.IntegerField(read_only=True)
    audio_ready_count = serializers.IntegerField(read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = EnglishLesson
        fields = [
            "id", "title", "slug", "source", "level",
            "segment_count", "audio_ready_count",
            "is_owner", "is_public", "audio_status",
        ]

    def get_is_owner(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and obj.owner_id == request.user.id)


class EnglishLessonDetailSerializer(serializers.ModelSerializer):
    segments = EnglishSegmentSerializer(many=True, read_only=True)
    audio_ready_count = serializers.IntegerField(read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = EnglishLesson
        fields = [
            "id", "title", "slug", "source", "source_url", "level",
            "is_owner", "is_public", "audio_status", "error",
            "audio_ready_count", "segments",
        ]

    def get_is_owner(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and obj.owner_id == request.user.id)


class EnglishLessonUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnglishLesson
        fields = ["id", "title", "level", "is_public"]


class EnglishLessonCreateSerializer(serializers.ModelSerializer):
    """Create a lesson from EITHER a block of English text (custom → TTS) OR a
    YouTube URL (Spec 073 → ingested from the original audio by a worker)."""

    text = serializers.CharField(write_only=True, required=False, allow_blank=True)
    source_url = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = EnglishLesson
        fields = ["id", "title", "level", "is_public", "text", "source_url"]
        extra_kwargs = {"title": {"required": False}}

    def _check_text(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) > MAX_TEXT_CHARS:
            raise serializers.ValidationError(
                {"text": f"Teks terlalu panjang (maks {MAX_TEXT_CHARS} karakter)."}
            )
        sentences = split_sentences(cleaned)
        if not sentences:
            raise serializers.ValidationError({"text": "Teks tidak berisi kalimat."})
        if len(sentences) > MAX_SEGMENTS:
            raise serializers.ValidationError(
                {"text": f"Terlalu banyak kalimat (maks {MAX_SEGMENTS})."}
            )
        self._sentences = sentences
        return cleaned

    def validate(self, attrs):
        from . import youtube

        text = (attrs.get("text") or "").strip()
        url = (attrs.get("source_url") or "").strip()
        if bool(text) == bool(url):
            raise serializers.ValidationError(
                "Isi salah satu: teks English ATAU URL YouTube (bukan keduanya)."
            )
        if url:
            if not youtube.extract_video_id(url):
                raise serializers.ValidationError(
                    {"source_url": "URL YouTube tidak valid."}
                )
            attrs["source_url"] = url
            if not (attrs.get("title") or "").strip():
                attrs["title"] = youtube.oembed_title(url) or "Video YouTube"
            self._mode = EnglishLesson.Source.YOUTUBE
        else:
            attrs["text"] = self._check_text(text)
            if not (attrs.get("title") or "").strip():
                raise serializers.ValidationError({"title": "Judul wajib diisi."})
            self._mode = EnglishLesson.Source.CUSTOM
        return attrs

    def create(self, validated):
        user = self.context["request"].user
        common = {
            "owner": user,
            "title": validated["title"],
            "level": validated.get("level", EnglishLesson.Level.BEGINNER),
            "audio_status": EnglishLesson.Status.PENDING,
        }
        if self._mode == EnglishLesson.Source.YOUTUBE:
            # Copyrighted original audio → non-public by default; owner can toggle.
            return EnglishLesson.objects.create(
                source=EnglishLesson.Source.YOUTUBE,
                source_url=validated["source_url"],
                is_public=False,
                **common,
            )
        lesson = EnglishLesson.objects.create(
            source=EnglishLesson.Source.CUSTOM,
            is_public=validated.get("is_public", False),
            **common,
        )
        EnglishSegment.objects.bulk_create(
            EnglishSegment(lesson=lesson, order=i, text=s)
            for i, s in enumerate(self._sentences)
        )
        return lesson


class EnglishWeakPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnglishWeakPoint
        fields = ["phoneme", "fail_count", "pass_streak", "total_attempts", "status"]


class EnglishStreakSerializer(serializers.ModelSerializer):
    practiced_today = serializers.SerializerMethodField()

    class Meta:
        model = EnglishStreak
        fields = [
            "current_streak",
            "longest_streak",
            "last_practice_date",
            "practiced_today",
        ]

    def get_practiced_today(self, obj) -> bool:
        from django.utils import timezone

        return obj.last_practice_date == timezone.localdate()


class EnglishWordPracticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnglishWordPractice
        fields = ["word", "fail_count", "pass_streak", "status", "manual"]
