from rest_framework import serializers

from .models import EnglishLesson, EnglishSegment


class EnglishSegmentSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = EnglishSegment
        fields = ["id", "order", "text", "audio_url", "duration_s"]

    def get_audio_url(self, obj) -> str:
        request = self.context.get("request")
        url = obj.audio.url
        return request.build_absolute_uri(url) if request else url


class EnglishLessonListSerializer(serializers.ModelSerializer):
    segment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = EnglishLesson
        fields = ["id", "title", "slug", "source", "level", "segment_count"]


class EnglishLessonDetailSerializer(serializers.ModelSerializer):
    segments = EnglishSegmentSerializer(many=True, read_only=True)

    class Meta:
        model = EnglishLesson
        fields = ["id", "title", "slug", "source", "source_url", "level", "segments"]
