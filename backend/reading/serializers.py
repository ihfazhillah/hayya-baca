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
        request = self.context.get("request")
        device_id = request.META.get("HTTP_X_DEVICE_ID", "") if request else ""

        new_last_page = validated_data["last_page"]
        new_completed = validated_data.get("completed", False)
        new_completed_count = validated_data.get("completed_count", 0)

        try:
            obj = ReadingProgress.objects.get(
                child_id=validated_data["child_id"],
                book=validated_data["book"],
            )
            # Update with max() to prevent regression
            obj.last_page = max(obj.last_page, new_last_page)
            obj.completed_count = max(obj.completed_count, new_completed_count)
            obj.completed = obj.completed or new_completed
            obj.source_device = device_id
            if new_completed and not obj.completed_at:
                obj.completed_at = timezone.now()
            obj.save()
        except ReadingProgress.DoesNotExist:
            obj = ReadingProgress.objects.create(
                child_id=validated_data["child_id"],
                book=validated_data["book"],
                last_page=new_last_page,
                completed=new_completed,
                completed_count=new_completed_count,
                completed_at=timezone.now() if new_completed else None,
                source_device=device_id,
            )

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
