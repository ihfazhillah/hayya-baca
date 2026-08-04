import re

from rest_framework import serializers

from .models import EnglishLesson, EnglishSegment
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
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = EnglishLesson
        fields = [
            "id", "title", "slug", "source", "level",
            "segment_count", "is_owner", "is_public", "audio_status",
        ]

    def get_is_owner(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and obj.owner_id == request.user.id)


class EnglishLessonDetailSerializer(serializers.ModelSerializer):
    segments = EnglishSegmentSerializer(many=True, read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = EnglishLesson
        fields = [
            "id", "title", "slug", "source", "source_url", "level",
            "is_owner", "is_public", "audio_status", "error", "segments",
        ]

    def get_is_owner(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and obj.owner_id == request.user.id)


class EnglishLessonUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnglishLesson
        fields = ["id", "title", "level", "is_public"]


class EnglishLessonCreateSerializer(serializers.ModelSerializer):
    text = serializers.CharField(write_only=True)

    class Meta:
        model = EnglishLesson
        fields = ["id", "title", "level", "is_public", "text"]

    def validate_text(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Teks tidak boleh kosong.")
        if len(cleaned) > MAX_TEXT_CHARS:
            raise serializers.ValidationError(
                f"Teks terlalu panjang (maks {MAX_TEXT_CHARS} karakter)."
            )
        sentences = split_sentences(cleaned)
        if not sentences:
            raise serializers.ValidationError("Teks tidak berisi kalimat.")
        if len(sentences) > MAX_SEGMENTS:
            raise serializers.ValidationError(
                f"Terlalu banyak kalimat (maks {MAX_SEGMENTS})."
            )
        self._sentences = sentences
        return cleaned

    def create(self, validated):
        validated.pop("text")
        lesson = EnglishLesson.objects.create(
            owner=self.context["request"].user,
            source=EnglishLesson.Source.CUSTOM,
            audio_status=EnglishLesson.Status.PENDING,
            **validated,
        )
        EnglishSegment.objects.bulk_create(
            EnglishSegment(lesson=lesson, order=i, text=s)
            for i, s in enumerate(self._sentences)
        )
        return lesson
