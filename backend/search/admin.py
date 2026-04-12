from django.contrib import admin

from .models import SearchLog, SearchSuggestion


@admin.register(SearchSuggestion)
class SearchSuggestionAdmin(admin.ModelAdmin):
    list_display = ("phrase", "source", "weight", "updated_at")
    list_filter = ("source",)
    search_fields = ("phrase",)


@admin.register(SearchLog)
class SearchLogAdmin(admin.ModelAdmin):
    list_display = ("query", "child", "result_type", "result_slug", "created_at")
    list_filter = ("result_type",)
    search_fields = ("query", "result_slug")
