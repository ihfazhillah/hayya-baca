from django.contrib import admin

from .models import Badge, Streak


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ["level", "name", "day_threshold", "icon_reference"]
    ordering = ["level"]


@admin.register(Streak)
class StreakAdmin(admin.ModelAdmin):
    list_display = ["child", "current_streak", "longest_streak", "last_reading_date", "badge"]
    list_filter = ["last_reading_date"]
    search_fields = ["child__name"]
