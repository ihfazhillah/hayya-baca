from django.contrib import admin

from .models import Santri, TahsinItem, TahsinRecord, TahsinScore


@admin.register(TahsinItem)
class TahsinItemAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "owner", "order", "is_active")
    list_filter = ("owner", "is_active")


@admin.register(Santri)
class SantriAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_pengampu", "pengampu", "is_active")
    list_filter = ("owner", "is_pengampu", "is_active")


class ScoreInline(admin.TabularInline):
    model = TahsinScore
    extra = 0


@admin.register(TahsinRecord)
class TahsinRecordAdmin(admin.ModelAdmin):
    list_display = ("santri", "date", "page", "owner", "created_by")
    list_filter = ("owner", "date")
    inlines = [ScoreInline]
