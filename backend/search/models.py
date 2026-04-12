from django.db import models


class SearchSuggestion(models.Model):
    SOURCE_NGRAM = "ngram_title"
    SOURCE_USER = "user_query"
    SOURCE_CHOICES = [
        (SOURCE_NGRAM, "Ngram Title"),
        (SOURCE_USER, "User Query"),
    ]

    phrase = models.CharField(max_length=255, unique=True, db_index=True)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES)
    weight = models.FloatField(default=0.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["source", "-weight"])]

    def __str__(self):
        return f"{self.phrase} ({self.source}, w={self.weight:.2f})"


class SearchLog(models.Model):
    TYPE_BOOK = "book"
    TYPE_ARTICLE = "article"
    TYPE_CHOICES = [
        (TYPE_BOOK, "Book"),
        (TYPE_ARTICLE, "Article"),
    ]

    child = models.ForeignKey(
        "accounts.Child",
        on_delete=models.CASCADE,
        related_name="search_logs",
    )
    query = models.CharField(max_length=255, db_index=True)
    result_slug = models.CharField(max_length=255)
    result_type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["-created_at"])]

    def __str__(self):
        return f"{self.child} [{self.query!r} → {self.result_type}:{self.result_slug}]"
