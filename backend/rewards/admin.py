from django.contrib import admin
from django.db.models import Sum
from django.utils import timezone

from .models import RewardHistory


@admin.action(description="Void selected rewards (deduct from child coins/stars)")
def void_rewards(modeladmin, request, queryset):
    for reward in queryset.filter(voided=False):
        reward.voided = True
        reward.voided_at = timezone.now()
        reward.voided_reason = f"Voided by {request.user}"
        reward.save()
        # Deduct from child
        child = reward.child
        if reward.type in ("coin", "coin_adjustment"):
            child.coins -= reward.count
        elif reward.type in ("star", "star_adjustment"):
            child.stars -= reward.count
        child.save(update_fields=["coins", "stars"])


@admin.register(RewardHistory)
class RewardHistoryAdmin(admin.ModelAdmin):
    list_display = [
        "child", "type", "count", "description", "source_device",
        "voided", "idempotency_key", "created_at",
    ]
    list_filter = ["type", "voided", "source_device"]
    search_fields = ["child__name", "description", "idempotency_key"]
    actions = [void_rewards]
    readonly_fields = ["idempotency_key", "source_device", "created_at"]
