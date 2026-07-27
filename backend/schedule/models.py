"""Per-child daily schedule (Spec 062).

A child owns their own schedule; a guardian may also add tasks. Tasks are either
recurring (routine, on selected weekdays) or one-time (a specific date), grouped
by part of day. Completion is tracked per task per date so history is preserved.
"""
from django.conf import settings
from django.db import models

from accounts.models import Child

PARTS_ORDER = ["pagi", "siang", "sore", "malam"]


class ScheduleTask(models.Model):
    class PartOfDay(models.TextChoices):
        PAGI = "pagi", "Pagi"
        SIANG = "siang", "Siang"
        SORE = "sore", "Sore"
        MALAM = "malam", "Malam"

    class Kind(models.TextChoices):
        ROUTINE = "routine", "Rutin"
        ONCE = "once", "Sekali"

    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, related_name="schedule_tasks"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    title = models.CharField(max_length=120)
    part_of_day = models.CharField(max_length=8, choices=PartOfDay.choices)
    kind = models.CharField(max_length=8, choices=Kind.choices)
    # ROUTINE: weekdays it repeats on (Monday=0 … Sunday=6).
    repeat_days = models.JSONField(default=list, blank=True)
    # ONCE: the single date it applies to.
    date = models.DateField(null=True, blank=True)
    emoji = models.CharField(max_length=8, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def applies_on(self, day):
        """Whether this task shows up on the given date."""
        if self.archived:
            return False
        if self.kind == self.Kind.ONCE:
            return self.date == day
        return day.weekday() in (self.repeat_days or [])


class TaskCompletion(models.Model):
    task = models.ForeignKey(
        ScheduleTask, on_delete=models.CASCADE, related_name="completions"
    )
    date = models.DateField()
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("task", "date")
