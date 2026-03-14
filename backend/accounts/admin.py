from django.contrib import admin
from django.db.models import Sum

from .models import Child, ChildAccess, ShareInvite


class ChildAccessInline(admin.TabularInline):
    model = ChildAccess
    extra = 1


@admin.action(description="Recalculate coins/stars from reward history")
def recalculate_totals(modeladmin, request, queryset):
    for child in queryset:
        from rewards.models import RewardHistory
        from games.models import GameSession

        coin_sum = (
            RewardHistory.objects.filter(
                child=child, type__in=["coin", "coin_adjustment"], voided=False
            ).aggregate(total=Sum("count"))["total"] or 0
        )
        star_sum = (
            RewardHistory.objects.filter(
                child=child, type__in=["star", "star_adjustment"], voided=False
            ).aggregate(total=Sum("count"))["total"] or 0
        )
        game_spent = (
            GameSession.objects.filter(child=child).aggregate(
                total=Sum("coins_spent")
            )["total"] or 0
        )
        child.coins = coin_sum - game_spent
        child.stars = star_sum
        child.save(update_fields=["coins", "stars"])


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ["name", "age", "coins", "stars", "created_by"]
    inlines = [ChildAccessInline]
    actions = [recalculate_totals]


@admin.register(ShareInvite)
class ShareInviteAdmin(admin.ModelAdmin):
    list_display = ["code", "child", "role", "expires_at", "used"]
