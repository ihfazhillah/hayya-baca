from django.conf import settings
from django.db import models

from accounts.models import Child


class SyncLog(models.Model):
    class Action(models.TextChoices):
        PUSH_REWARDS = "push_rewards"
        PUSH_PROGRESS = "push_progress"
        PULL_CHILDREN = "pull_children"
        PUSH_CHILDREN = "push_children"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sync_logs"
    )
    device_id = models.CharField(max_length=255, blank=True, default="")
    device_name = models.CharField(max_length=255, blank=True, default="")
    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, null=True, blank=True, related_name="sync_logs"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=20, choices=Action.choices)
    item_count = models.PositiveIntegerField(default=0)
    details = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user} {self.action} ({self.item_count} items) @ {self.timestamp}"


class DeviceTelemetry(models.Model):
    """One row per (user, device) capturing the last-known sync health.

    Piggybacks on each push so operators can spot silent devices without a
    separate endpoint. Queue depth + last_successful_sync_at together answer
    "is this device stuck?" at a glance.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_telemetry"
    )
    device_id = models.CharField(max_length=255)
    device_name = models.CharField(max_length=255, blank=True, default="")
    app_version = models.CharField(max_length=64, blank=True, default="")
    queue_depth_rewards = models.PositiveIntegerField(default=0)
    queue_depth_progress = models.PositiveIntegerField(default=0)
    last_successful_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_error = models.TextField(blank=True, default="")
    reported_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "device_id")]
        ordering = ["-reported_at"]

    def __str__(self):
        return f"{self.user} / {self.device_id} @ {self.reported_at}"
