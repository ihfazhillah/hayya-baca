import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.text import slugify


class EnglishLessonQuerySet(models.QuerySet):
    def visible_to(self, user):
        """Lessons an authenticated user may see (Spec 064 visibility rule):

        - their own lessons (any status — includes drafts/processing);
        - anyone's public lessons that are ready;
        - legacy admin lessons (no owner) that are published.
        """
        return self.filter(
            Q(owner=user)
            | Q(is_public=True, audio_status=EnglishLesson.Status.READY)
            | Q(owner__isnull=True, is_published=True)
        )


class EnglishLesson(models.Model):
    """A listening/speaking practice lesson in Australian-accent English.

    Two origins:
    - Admin lessons imported offline by tools/english-pipeline via
      `manage.py import_english_lesson` (owner=None, gated by is_published).
    - User lessons created from english-web (owner set); their EN-AU audio is
      generated server-side by the MeloTTS worker (audio_status lifecycle).
    """

    class Source(models.TextChoices):
        CUSTOM = "custom", "Teks Custom (MeloTTS EN-AU)"
        YOUTUBE = "youtube", "YouTube"

    class Level(models.TextChoices):
        BEGINNER = "beginner", "Pemula"
        INTERMEDIATE = "intermediate", "Menengah"
        ADVANCED = "advanced", "Lanjutan"

    class Status(models.TextChoices):
        PENDING = "pending", "Menunggu"
        PROCESSING = "processing", "Diproses"
        READY = "ready", "Siap"
        FAILED = "failed", "Gagal"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices)
    source_url = models.URLField(blank=True)
    level = models.CharField(
        max_length=15, choices=Level.choices, default=Level.BEGINNER
    )

    # Ownership & visibility (Spec 064). owner=None → admin lesson.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="english_lessons",
    )
    is_public = models.BooleanField(default=False)

    # Server-side audio generation lifecycle (user lessons). Admin-imported
    # lessons already ship audio → default READY.
    audio_status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.READY
    )
    error = models.TextField(blank=True)

    # Publishing — same pattern as library.Book (admin lessons).
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = EnglishLessonQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "lesson"
            slug = base
            # Collision-safe: user lessons can repeat titles across accounts.
            while (
                EnglishLesson.objects.filter(slug=slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                slug = f"{base}-{secrets.token_hex(3)}"
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class EnglishSegment(models.Model):
    """One practice unit (~a sentence): audio clip + reference text.

    For user-created lessons the audio is empty until the MeloTTS worker fills
    it in, so `audio` is blank-able.
    """

    lesson = models.ForeignKey(
        EnglishLesson, on_delete=models.CASCADE, related_name="segments"
    )
    order = models.PositiveIntegerField()
    text = models.TextField()
    audio = models.FileField(upload_to="english/segments/", blank=True)
    duration_s = models.FloatField(default=0.0)

    class Meta:
        ordering = ["order"]
        unique_together = [("lesson", "order")]

    def __str__(self):
        return f"{self.lesson.slug} #{self.order}"


class EnglishWeakPoint(models.Model):
    """A phoneme a learner keeps getting wrong ("Fitness Lidah", Spec 066).

    Per-user aggregate: the frontend maps mis-said words → target phonemes and
    posts pass/fail deltas; this model owns the threshold state machine that
    decides which sounds are ACTIVE (in the drill queue) vs CLEARED.
    """

    class Status(models.TextChoices):
        TRACKING = "tracking", "Dipantau"
        ACTIVE = "active", "Perlu latihan"
        CLEARED = "cleared", "Lulus"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="english_weakpoints",
    )
    phoneme = models.CharField(max_length=8)  # target id, e.g. "TH", "R", "V"
    fail_count = models.PositiveIntegerField(default=0)
    pass_streak = models.PositiveIntegerField(default=0)
    total_attempts = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.TRACKING
    )
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("owner", "phoneme")]
        ordering = ["-fail_count", "phoneme"]

    def __str__(self):
        return f"{self.owner_id}:{self.phoneme} ({self.status})"


class EnglishWordPractice(models.Model):
    """A specific word/phrase the learner practices pronouncing (Spec 069).

    Word-level counterpart to EnglishWeakPoint (phoneme-level): auto-collected
    from mis-said words in shadowing, or added manually.
    """

    class Status(models.TextChoices):
        TRACKING = "tracking", "Dipantau"
        ACTIVE = "active", "Perlu latihan"
        CLEARED = "cleared", "Lulus"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="english_words",
    )
    word = models.CharField(max_length=64)  # lowercased; short phrases allowed
    fail_count = models.PositiveIntegerField(default=0)
    pass_streak = models.PositiveIntegerField(default=0)
    total_attempts = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.TRACKING
    )
    manual = models.BooleanField(default=False)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("owner", "word")]
        ordering = ["-fail_count", "word"]

    def __str__(self):
        return f"{self.owner_id}:{self.word} ({self.status})"


class EnglishStreak(models.Model):
    """Per-user daily practice streak for the English module (Spec 068).

    Independent of the Child reading streak (`streaks` app). A day counts when
    the learner completes ≥1 scored attempt that day.
    """

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="english_streak",
    )
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_practice_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def register_practice(self, today):
        """Record a practice on `today`; returns self. Idempotent per day."""
        if self.last_practice_date == today:
            return self
        if self.last_practice_date == today - timedelta(days=1):
            self.current_streak += 1
        else:
            self.current_streak = 1
        self.last_practice_date = today
        self.longest_streak = max(self.longest_streak, self.current_streak)
        return self

    def __str__(self):
        return f"{self.owner_id}: {self.current_streak}d"
