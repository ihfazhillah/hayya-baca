import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

# Non-ambiguous alphabet for human-typed setup codes (no O/0/I/1/L).
SETUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
SETUP_CODE_LENGTH = 8
SETUP_TOKEN_TTL = timedelta(minutes=15)

LOCKOUT_THRESHOLD = 5
LOCKOUT_BASE_SECONDS = 60
LOCKOUT_MAX_SECONDS = 15 * 60


def is_child_account(user):
    """True if `user` is a linked diary account for a Child (not a guardian)."""
    if not getattr(user, "is_authenticated", False):
        return False
    return hasattr(user, "child_profile")


class Child(models.Model):
    name = models.CharField(max_length=100)
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    avatar_color = models.CharField(max_length=7, default="#1A73E8")
    coins = models.IntegerField(default=0)
    stars = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_children",
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="child_profile",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "children"

    def __str__(self):
        return self.name


class ChildAccess(models.Model):
    class Role(models.TextChoices):
        PARENT = "parent"
        TEACHER = "teacher"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="child_access",
    )
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="access")
    role = models.CharField(max_length=10, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "child"]

    def clean(self):
        if self.role == self.Role.PARENT:
            parent_count = (
                ChildAccess.objects.filter(child=self.child, role=self.Role.PARENT)
                .exclude(pk=self.pk)
                .count()
            )
            if parent_count >= 2:
                raise ValidationError("Anak sudah punya 2 orang tua")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} → {self.child} ({self.role})"


class PasswordSetupToken(models.Model):
    """One-time token letting a child set their own password (setup or reset)."""

    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, related_name="setup_tokens"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    code = models.CharField(max_length=SETUP_CODE_LENGTH, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def _new_code():
        while True:
            code = "".join(
                secrets.choice(SETUP_CODE_ALPHABET) for _ in range(SETUP_CODE_LENGTH)
            )
            if not PasswordSetupToken.objects.filter(code=code).exists():
                return code

    @classmethod
    def generate(cls, child, created_by):
        # Void any still-active token for this child so only one code works.
        cls.objects.filter(child=child, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        return cls.objects.create(
            child=child,
            created_by=created_by,
            code=cls._new_code(),
            expires_at=timezone.now() + SETUP_TOKEN_TTL,
        )

    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def mark_used(self):
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])

    def __str__(self):
        return f"setup {self.code} → {self.child}"


class LoginLockout(models.Model):
    """Progressive per-username lockout for child login attempts."""

    username = models.CharField(max_length=150, unique=True)
    failed_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @staticmethod
    def lock_seconds(failed_count):
        if failed_count < LOCKOUT_THRESHOLD:
            return 0
        seconds = LOCKOUT_BASE_SECONDS * (2 ** (failed_count - LOCKOUT_THRESHOLD))
        return min(seconds, LOCKOUT_MAX_SECONDS)

    @classmethod
    def is_locked(cls, username):
        lock = cls.objects.filter(username=username).first()
        if not lock or lock.locked_until is None:
            return False
        return lock.locked_until > timezone.now()

    @classmethod
    def record_failure(cls, username):
        lock, _ = cls.objects.get_or_create(username=username)
        lock.failed_count += 1
        seconds = cls.lock_seconds(lock.failed_count)
        if seconds:
            lock.locked_until = timezone.now() + timedelta(seconds=seconds)
        lock.save()
        return lock

    @classmethod
    def reset(cls, username):
        cls.objects.filter(username=username).delete()

    def __str__(self):
        return f"lockout {self.username} ({self.failed_count})"


class ShareInvite(models.Model):
    child = models.ForeignKey(Child, on_delete=models.CASCADE)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    code = models.CharField(max_length=8, unique=True)
    role = models.CharField(
        max_length=10,
        choices=ChildAccess.Role.choices,
        default=ChildAccess.Role.TEACHER,
    )
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.code} → {self.child} ({self.role})"
