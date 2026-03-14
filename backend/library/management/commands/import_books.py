"""Import books from content/books/*/raw.json into the database."""

import json
from math import ceil
from pathlib import Path

from django.core.management.base import BaseCommand

from library.models import Book, BookPage


class Command(BaseCommand):
    help = "Import books from content/books/*/raw.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--content-dir",
            default=str(Path(__file__).resolve().parents[4] / "content" / "books"),
            help="Path to content/books/ directory",
        )

    def handle(self, *args, **options):
        content_dir = Path(options["content_dir"])
        if not content_dir.exists():
            self.stderr.write(f"Directory not found: {content_dir}")
            return

        imported = 0
        for book_dir in sorted(content_dir.iterdir()):
            raw_file = book_dir / "raw.json"
            if not raw_file.exists():
                continue

            with open(raw_file) as f:
                data = json.load(f)

            book, created = Book.objects.update_or_create(
                id=data["id"],
                defaults={
                    "title": data["title"],
                    "content_type": Book.ContentType.BOOK,
                    "source": "",
                    "reference_ar": data.get("reference_text_ar", ""),
                    "reference_id": data.get("reference_text_id", ""),
                    "slug": str(data["id"]),
                    "has_audio": any(p.get("audio") for p in data["pages"]),
                    "min_age": 0,
                    "reward_coins": ceil(len(data["pages"]) / 5),
                },
            )

            if not created:
                book.pages.all().delete()

            for page_data in data["pages"]:
                BookPage.objects.create(
                    book=book,
                    page=page_data["page"],
                    text=page_data["text"],
                    audio=page_data.get("audio") or "",
                )

            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {book.title} ({len(data['pages'])} pages)")
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported {imported} books"))
