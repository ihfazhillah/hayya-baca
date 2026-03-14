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
