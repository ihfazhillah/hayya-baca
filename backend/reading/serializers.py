from django.utils import timezone
from rest_framework import serializers

from library.models import Book
from .models import QuizAttempt, ReadingProgress


class ReadingProgressSerializer(serializers.ModelSerializer):
    book = serializers.SlugRelatedField(slug_field='slug', queryset=Book.objects.all())

    class Meta:
        model = ReadingProgress
        fields = [
            "id", "child", "book", "last_page", "completed",
            "completed_count", "first_read_at", "completed_at", "updated_at",
        ]
        read_only_fields = ["id", "child", "first_read_at", "completed_at", "updated_at"]
        validators = []  # disable unique_together validator; create() does upsert

    def create(self, validated_data):
        completed = validated_data.get("completed", False)
        defaults = {
            "last_page": validated_data["last_page"],
            "completed": completed,
            "completed_count": validated_data.get("completed_count", 0),
        }
        if completed:
            defaults["completed_at"] = timezone.now()
        obj, created = ReadingProgress.objects.update_or_create(
            child_id=validated_data["child_id"],
            book=validated_data["book"],
            defaults=defaults,
        )
        # Don't overwrite first_read_at on update — it's set by default on create
        return obj


class QuizAttemptSerializer(serializers.ModelSerializer):
    book = serializers.SlugRelatedField(slug_field='slug', queryset=Book.objects.all())

    class Meta:
        model = QuizAttempt
        fields = ["id", "child", "book", "score", "total", "stars_earned", "created_at"]
        read_only_fields = ["id", "child", "stars_earned", "created_at"]

    def create(self, validated_data):
        score = validated_data["score"]
        total = validated_data["total"]
        pct = score / total if total > 0 else 0
        if pct >= 1.0:
            stars = 4
        elif pct >= 0.75:
            stars = 3
        elif pct >= 0.5:
            stars = 2
        elif pct >= 0.25:
            stars = 1
        else:
            stars = 0

        validated_data["stars_earned"] = stars
        attempt = super().create(validated_data)

        # Update child stars
        child = attempt.child
        child.stars += stars
        child.save(update_fields=["stars"])

        return attempt
