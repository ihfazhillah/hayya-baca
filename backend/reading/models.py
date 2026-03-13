from django.db import models
from django.utils import timezone

from accounts.models import Child
from library.models import Book


class ReadingProgress(models.Model):
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="progress")
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    last_page = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    completed_count = models.PositiveIntegerField(default=0)
    first_read_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["child", "book"]

    def __str__(self):
        return f"{self.child} - {self.book} (p.{self.last_page})"


class QuizAttempt(models.Model):
    child = models.ForeignKey(
        Child, on_delete=models.CASCADE, related_name="quiz_attempts"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    score = models.PositiveIntegerField()
    total = models.PositiveIntegerField()
    stars_earned = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.child} - {self.book} ({self.score}/{self.total})"
