from django.db import models

from accounts.models import Child


class RewardHistory(models.Model):
    class Type(models.TextChoices):
        COIN = "coin"
        STAR = "star"

    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, related_name="reward_history"
    )
    type = models.CharField(max_length=4, choices=Type.choices)
    count = models.IntegerField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    synced = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "reward histories"

    def __str__(self):
        return f"{self.child} +{self.count} {self.type}"
