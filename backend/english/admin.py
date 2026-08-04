from django.contrib import admin
from django.utils import timezone

from .models import EnglishLesson, EnglishSegment


class EnglishSegmentInline(admin.TabularInline):
    model = EnglishSegment
    extra = 0
    fields = ("order", "text", "audio", "duration_s")


@admin.register(EnglishLesson)
class EnglishLessonAdmin(admin.ModelAdmin):
    list_display = (
        "title", "owner", "source", "level",
        "is_public", "audio_status", "is_published",
    )
    list_filter = ("source", "level", "is_public", "audio_status", "is_published")
    search_fields = ("title", "slug", "owner__username")
    autocomplete_fields = ("owner",)
    readonly_fields = ("audio_status", "error")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [EnglishSegmentInline]
    actions = ["publish_lessons", "unpublish_lessons"]

    @admin.action(description="Publish lesson terpilih")
    def publish_lessons(self, request, queryset):
        queryset.update(is_published=True, published_at=timezone.now())

    @admin.action(description="Unpublish lesson terpilih")
    def unpublish_lessons(self, request, queryset):
        queryset.update(is_published=False)
