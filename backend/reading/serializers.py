from django.utils import timezone
from rest_framework import serializers

from library.models import Book
from .models import QuizAttempt, ReadingLog, ReadingProgress


class AutoCreateBookSlugField(serializers.SlugRelatedField):
    """Resolve Book loosely: try slug, then numeric pk, then create a stub.

    Why: mobile bundles content (books + articles) whose slugs may not
    match what's on the server (BC-6). Mobile sends numeric string ids
    ("1", "5", "24") from bundled JSON and slugified titles for
    articles. Hard-failing with 400 causes permanent data loss —
    reading_progress stays synced=0 forever. Resolution order:

    1. slug match (the intended key)
    2. pk match if the payload is all-digit (legacy ids from early
       builds where mobile sent numeric pk instead of slug)
    3. create an unpublished stub as last resort so sync never loses a
       row; admins can backfill metadata later.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("slug_field", "slug")
        kwargs.setdefault("queryset", Book.objects.all())
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        key = str(data)

        book = Book.objects.filter(slug=key).first()
        if book is not None:
            return book

        if key.isdigit():
            book = Book.objects.filter(pk=int(key)).first()
            if book is not None:
                return book

        book, _ = Book.objects.get_or_create(
            slug=key,
            defaults={
                "title": f"Book {key}",
                "content_type": Book.ContentType.BOOK,
                "is_published": False,
            },
        )
        return book


class ReadingProgressSerializer(serializers.ModelSerializer):
    book = AutoCreateBookSlugField()

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


class ReadingLogEntrySerializer(serializers.Serializer):
    book_id = serializers.CharField()
    completed_at = serializers.DateTimeField()
    idempotency_key = serializers.CharField()


class ReadingLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingLog
        fields = ["id", "book_id", "completed_at", "idempotency_key"]
        read_only_fields = ["id"]
