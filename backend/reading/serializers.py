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
    completed_count = serializers.SerializerMethodField()

    class Meta:
        model = ReadingProgress
        fields = [
            "id", "child", "book", "last_page", "completed",
            "completed_count", "first_read_at", "completed_at", "updated_at",
        ]
        read_only_fields = ["id", "child", "first_read_at", "completed_at", "updated_at"]
        validators = []  # disable unique_together validator; create() does upsert

    def get_completed_count(self, obj):
        """Derived from the append-only ReadingLog — the event-sourced
        truth. Stored ReadingProgress.completed_count is a best-effort
        cache written opportunistically; we read the log so multi-device
        completions sum instead of MAX-collapse (MD-2 / RC-1)."""
        return ReadingLog.objects.filter(
            child_id=obj.child_id, book_id=obj.book.slug
        ).count()

    def to_internal_value(self, data):
        # completed_count is incoming-but-ignored: stored locally for
        # cache purposes, never trusted on read. Don't convert a
        # QueryDict to a plain dict via dict() — that wraps scalar
        # values in single-element lists and breaks downstream
        # validation of other fields (form-encoded posts from the
        # Django test client hit this path).
        if hasattr(data, "copy"):
            data = data.copy()
        else:
            data = dict(data)
        try:
            self._incoming_completed_count = int(data.pop("completed_count", 0) or 0)
        except (TypeError, ValueError):
            self._incoming_completed_count = 0
        return super().to_internal_value(data)

    def create(self, validated_data):
        request = self.context.get("request")
        device_id = request.META.get("HTTP_X_DEVICE_ID", "") if request else ""

        new_last_page = validated_data["last_page"]
        new_completed = validated_data.get("completed", False)
        new_completed_count = getattr(self, "_incoming_completed_count", 0)

        try:
            obj = ReadingProgress.objects.get(
                child_id=validated_data["child_id"],
                book=validated_data["book"],
            )
            # last_page is a "how far into the book are we" progress
            # bar — MAX is correct. completed_count is a counter whose
            # truth lives in ReadingLog, so we just refresh the cache
            # from the log instead of MAX-ing the payload.
            obj.last_page = max(obj.last_page, new_last_page)
            obj.completed = obj.completed or new_completed
            obj.completed_count = ReadingLog.objects.filter(
                child_id=obj.child_id, book_id=obj.book.slug
            ).count() or max(obj.completed_count, new_completed_count)
            obj.source_device = device_id
            if new_completed and not obj.completed_at:
                obj.completed_at = timezone.now()
            obj.save()
        except ReadingProgress.DoesNotExist:
            log_count = ReadingLog.objects.filter(
                child_id=validated_data["child_id"],
                book_id=validated_data["book"].slug,
            ).count()
            obj = ReadingProgress.objects.create(
                child_id=validated_data["child_id"],
                book=validated_data["book"],
                last_page=new_last_page,
                completed=new_completed,
                completed_count=log_count or new_completed_count,
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
