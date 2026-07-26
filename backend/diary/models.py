"""Ruang Cerita diary models (Spec 060)."""
from django.conf import settings
from django.db import models

from accounts.models import Child

# Quick-react emoji set (Spec 060 §5.2).
REACTION_EMOJIS = ["❤️", "👏", "🌟", "😄"]


class PostType(models.Model):
    """Kind of writing a child picks up front; drives the editor shape."""

    class Kind(models.TextChoices):
        TEXT = "text"
        COMIC = "comic"

    slug = models.SlugField(unique=True)
    label = models.CharField(max_length=50)
    emoji = models.CharField(max_length=8, blank=True, default="")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.label


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        PUBLISHED = "published"

    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, related_name="diary_posts"
    )
    type = models.ForeignKey(PostType, on_delete=models.PROTECT)
    title = models.CharField(max_length=200, blank=True, default="")
    body = models.JSONField(null=True, blank=True)  # ProseMirror JSON; null for comic
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.DRAFT
    )
    published_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} · {self.child}"


class ComicPanel(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="panels")
    order = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to="diary/panels/%Y/%m/")
    caption = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["order", "id"]


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.JSONField()  # ProseMirror JSON (same whitelist as Post)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["created_at", "id"]


class Reaction(models.Model):
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name="reactions"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["post", "user", "emoji"]


class ReadReceipt(models.Model):
    """Tracks a user opening a post: read receipt (guardian) + unread badge."""

    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name="receipts"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # Null for the child's own views — a read receipt is a guardian concept.
    first_read_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField()

    class Meta:
        unique_together = ["post", "user"]


class TelegramLink(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telegram_link",
    )
    chat_id = models.CharField(max_length=32, null=True, blank=True)
    link_code = models.CharField(max_length=16, unique=True)
    code_expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
