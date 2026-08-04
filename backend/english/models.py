from django.db import models
from django.utils.text import slugify


class EnglishLesson(models.Model):
    """A listening/speaking practice lesson in Australian-accent English.

    Audio is produced offline by tools/english-pipeline (MeloTTS EN-AU for
    custom-text lessons, yt-dlp segment cuts for YouTube lessons) and
    imported via `manage.py import_english_lesson <folder>`.
    """

    class Source(models.TextChoices):
        CUSTOM = "custom", "Teks Custom (MeloTTS EN-AU)"
        YOUTUBE = "youtube", "YouTube"

    class Level(models.TextChoices):
        BEGINNER = "beginner", "Pemula"
        INTERMEDIATE = "intermediate", "Menengah"
        ADVANCED = "advanced", "Lanjutan"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices)
    source_url = models.URLField(blank=True)
    level = models.CharField(
        max_length=15, choices=Level.choices, default=Level.BEGINNER
    )

    # Publishing — same pattern as library.Book
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class EnglishSegment(models.Model):
    """One practice unit (~a sentence): audio clip + reference text."""

    lesson = models.ForeignKey(
        EnglishLesson, on_delete=models.CASCADE, related_name="segments"
    )
    order = models.PositiveIntegerField()
    text = models.TextField()
    audio = models.FileField(upload_to="english/segments/")
    duration_s = models.FloatField(default=0.0)

    class Meta:
        ordering = ["order"]
        unique_together = [("lesson", "order")]

    def __str__(self):
        return f"{self.lesson.slug} #{self.order}"
