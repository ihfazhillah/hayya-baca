from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


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
