from django.db import models

from accounts.models import Child


class Badge(models.Model):
    """Progressive badge levels for reading streaks."""
    level = models.PositiveSmallIntegerField(unique=True)
    name = models.CharField(max_length=100)
    icon_reference = models.CharField(max_length=100)
    day_threshold = models.PositiveIntegerField()

    class Meta:
        ordering = ["level"]

    def __str__(self):
        return f"Level {self.level}: {self.name} ({self.day_threshold} days)"


class Streak(models.Model):
    """Per-child streak tracking with grace period support."""
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="streaks")
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_reading_date = models.DateField(null=True, blank=True)
    grace_period_end_date = models.DateField(null=True, blank=True)
    badge = models.ForeignKey(
        Badge,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="streaks",
    )

    class Meta:
        unique_together = ["child"]

    def __str__(self):
        return f"{self.child}: {self.current_streak} days (badge: {self.badge})"
