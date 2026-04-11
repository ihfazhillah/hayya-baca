"""Seed minimal data for e2e sync tests. Idempotent."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from library.models import Book


class Command(BaseCommand):
    help = "Seed e2e test user + book slugs. Idempotent."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username="e2e",
            defaults={"email": "e2e@test.local"},
        )
        if created:
            user.set_password("e2e-password")
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS("Created user e2e/e2e-password"))
        else:
            # Ensure password is known even if user existed from prior run.
            user.set_password("e2e-password")
            user.save()

        # Books with slugs "1".."4" to match app's static JSON IDs.
        for slug in ("1", "2", "3", "4"):
            Book.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": f"E2E Book {slug}",
                    "content_type": Book.ContentType.BOOK,
                    "reward_coins": 1,
                    "is_published": True,
                },
            )
        # Non-numeric slug for BC-6 pk-fallback test (Case 29).
        Book.objects.get_or_create(
            slug="e2e-alt",
            defaults={
                "title": "E2E Alt Slug",
                "content_type": Book.ContentType.BOOK,
                "reward_coins": 1,
                "is_published": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("Seeded books 1..4 + e2e-alt"))
