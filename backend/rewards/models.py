from django.db import models

from accounts.models import Child


class RewardHistory(models.Model):
    class Type(models.TextChoices):
        COIN = "coin"
        STAR = "star"
        COIN_ADJ = "coin_adjustment"
        STAR_ADJ = "star_adjustment"

    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, related_name="reward_history"
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    count = models.IntegerField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    synced = models.BooleanField(default=False)

    # Traceability
    source_device = models.CharField(max_length=255, blank=True, default="")
    idempotency_key = models.CharField(max_length=255, unique=True, null=True, blank=True)

    # Void support
    voided = models.BooleanField(default=False)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_reason = models.TextField(blank=True, default="")

    class Meta:
        verbose_name_plural = "reward histories"

    def __str__(self):
        prefix = "[VOID] " if self.voided else ""
        return f"{prefix}{self.child} +{self.count} {self.type}"
