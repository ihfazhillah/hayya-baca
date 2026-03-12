from rest_framework import serializers

from .models import ArticleSection, Book, BookPage, Quiz


class BookPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookPage
        fields = ["page", "text", "audio"]


class ArticleSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleSection
        fields = ["order", "type", "text", "items"]


class QuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = ["id", "order", "type", "question", "options", "answer", "explanation"]


class BookListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = [
            "id", "title", "content_type", "cover", "categories",
            "min_age", "reward_coins", "has_audio", "published_version",
        ]


class BookDetailSerializer(serializers.ModelSerializer):
    pages = BookPageSerializer(many=True, read_only=True)
    sections = ArticleSectionSerializer(many=True, read_only=True)
    quizzes = QuizSerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = [
            "id", "title", "content_type", "cover", "source", "source_url",
            "categories", "reference_ar", "reference_id", "min_age",
            "reward_coins", "has_audio", "published_version",
            "pages", "sections", "quizzes",
        ]
