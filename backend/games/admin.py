import zipfile
from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.utils.html import format_html

from .models import Game, GameSession


def extract_bundle(game):
    """Extract game zip bundle to media/games/<slug>/ for preview."""
    if not game.bundle:
        return
    dest = Path(settings.MEDIA_ROOT) / "games" / game.slug
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(game.bundle.path) as zf:
        zf.extractall(dest)


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = [
        "icon_title", "slug", "category", "difficulty",
        "coin_cost", "session_minutes", "is_published",
        "play_count", "bundle_version", "preview_link",
    ]
    list_filter = ["is_published", "category", "difficulty"]
    list_editable = ["is_published", "coin_cost", "session_minutes"]
    prepopulated_fields = {"slug": ("title",)}

    def icon_title(self, obj):
        return f"{obj.icon} {obj.title}"
    icon_title.short_description = "Game"

    def preview_link(self, obj):
        if not obj.bundle:
            return "—"
        url = f"{settings.MEDIA_URL}games/{obj.slug}/index.html"
        return format_html(
            '<a href="{}" target="_blank" style="text-decoration:none">▶️ Preview</a>',
            url,
        )
    preview_link.short_description = "Preview"

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if "bundle" in form.changed_data:
            extract_bundle(obj)


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ["child", "game", "coins_spent", "score", "started_at", "expires_at", "ended_at"]
    list_filter = ["game"]
    readonly_fields = ["child", "game", "coins_spent", "started_at", "expires_at", "score", "ended_at"]
