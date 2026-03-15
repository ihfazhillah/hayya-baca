from django.contrib import admin
from django.core.management import call_command
from django.urls import reverse
from django.utils.html import format_html

from .models import ArticleSection, Book, BookPage, Quiz


class BookPageInline(admin.TabularInline):
    model = BookPage
    extra = 0


class ArticleSectionInline(admin.TabularInline):
    model = ArticleSection
    extra = 0


class QuizInline(admin.StackedInline):
    model = Quiz
    extra = 0


@admin.action(description="Publish selected books")
def publish_books(modeladmin, request, queryset):
    call_command("publish", ids=[b.id for b in queryset])


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "content_type",
        "is_published",
        "published_version",
        "published_at",
        "min_age",
        "quiz_manager_link",
    ]
    list_filter = ["content_type", "is_published"]
    actions = [publish_books]

    def get_inlines(self, request, obj=None):
        if obj and obj.content_type == Book.ContentType.ARTICLE:
            return [ArticleSectionInline, QuizInline]
        return [BookPageInline]

    @admin.display(description="Tools")
    def quiz_manager_link(self, obj):
        return format_html('<a href="{}">Quiz Manager</a>', "/quiz-manager/")
