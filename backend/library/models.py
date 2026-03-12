from django.db import models


class Book(models.Model):
    class ContentType(models.TextChoices):
        BOOK = "book", "Buku Bacaan"
        ARTICLE = "article", "Artikel"

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    content_type = models.CharField(max_length=10, choices=ContentType.choices)
    cover = models.ImageField(upload_to="covers/", null=True, blank=True)
    source = models.CharField(max_length=255, blank=True)
    source_url = models.URLField(blank=True)
    categories = models.JSONField(default=list, blank=True)
    reference_ar = models.TextField(blank=True)
    reference_id = models.TextField(blank=True)
    has_audio = models.BooleanField(default=False)
    min_age = models.PositiveSmallIntegerField(default=0)
    reward_coins = models.PositiveIntegerField(default=1)

    # Publishing
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    published_version = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.content_type}] {self.title}"


class BookPage(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="pages")
    page = models.PositiveIntegerField()
    text = models.TextField()
    audio = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["page"]
        unique_together = ["book", "page"]

    def __str__(self):
        return f"{self.book.title} - p.{self.page}"


class ArticleSection(models.Model):
    class SectionType(models.TextChoices):
        PARAGRAPH = "paragraph"
        HEADING = "heading"
        ARABIC = "arabic"
        LIST = "list"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="sections")
    order = models.PositiveIntegerField()
    type = models.CharField(max_length=10, choices=SectionType.choices)
    text = models.TextField(blank=True)
    items = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.book.title} - s.{self.order} ({self.type})"


class Quiz(models.Model):
    class QuizType(models.TextChoices):
        MULTIPLE_CHOICE = "multiple_choice"
        TRUE_FALSE = "true_false"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="quizzes")
    order = models.PositiveIntegerField()
    type = models.CharField(max_length=20, choices=QuizType.choices)
    question = models.TextField()
    options = models.JSONField(default=list, blank=True)
    answer = models.JSONField()
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ["order"]
        verbose_name_plural = "quizzes"

    def __str__(self):
        return f"{self.book.title} - Q{self.order}"
