from django.db import models

from accounts.models import Child


class Game(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=10, help_text="Emoji icon")

    # Pricing
    coin_cost = models.PositiveIntegerField(default=1)
    session_minutes = models.PositiveIntegerField(default=5)

    # Game bundle
    bundle = models.FileField(upload_to="games/bundles/")
    bundle_version = models.PositiveIntegerField(default=1)

    # Control
    is_published = models.BooleanField(default=False)
    min_age = models.PositiveSmallIntegerField(default=0)
    difficulty = models.CharField(
        max_length=10,
        choices=[("easy", "Easy"), ("medium", "Medium"), ("hard", "Hard")],
        default="easy",
    )
    category = models.CharField(
        max_length=20,
        choices=[
            ("arcade", "Arcade"),
            ("puzzle", "Puzzle / Kata"),
            ("math", "Matematika"),
            ("creative", "Kreativitas"),
            ("islamic", "Islami"),
            ("reaction", "Reaksi"),
        ],
        default="arcade",
    )

    # Stats
    play_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.icon} {self.title}"


class GameSession(models.Model):
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name="game_sessions")
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="sessions")
    coins_spent = models.PositiveIntegerField()
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    score = models.IntegerField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.child} → {self.game} ({self.started_at:%Y-%m-%d %H:%M})"
