"""Publish books/articles as static JSON files."""

import json
from math import ceil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from library.models import Book


class Command(BaseCommand):
    help = "Publish books/articles as static JSON files"

    def add_arguments(self, parser):
        parser.add_argument("--ids", nargs="*", type=int, help="Specific book IDs")
        parser.add_argument(
            "--all", action="store_true", help="Publish all unpublished or updated"
        )
        parser.add_argument(
            "--force", action="store_true", help="Re-publish even if unchanged"
        )

    def handle(self, *args, **options):
        if options["ids"]:
            books = Book.objects.filter(id__in=options["ids"])
        elif options["all"]:
            if options["force"]:
                books = Book.objects.all()
            else:
                # Unpublished or updated since last publish
                from django.db.models import F, Q

                books = Book.objects.filter(
                    Q(is_published=False) | Q(updated_at__gt=F("published_at"))
                )
        else:
            self.stderr.write("Specify --ids or --all")
            return

        published_dir = Path(settings.PUBLISHED_ROOT)
        books_dir = published_dir / "books"
        articles_dir = published_dir / "articles"
        books_dir.mkdir(parents=True, exist_ok=True)
        articles_dir.mkdir(parents=True, exist_ok=True)

        count = 0
        for book in books:
            data = self._serialize(book)
            subdir = articles_dir if book.content_type == Book.ContentType.ARTICLE else books_dir
            out_path = subdir / f"{book.id}.json"
            with open(out_path, "w") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            book.is_published = True
            book.published_at = timezone.now()
            book.published_version += 1
            book.save(update_fields=["is_published", "published_at", "published_version"])

            self.stdout.write(f"  Published: {book.title} → {out_path.name} (v{book.published_version})")
            count += 1

        # Rebuild manifest
        self._rebuild_manifest(published_dir)
        self.stdout.write(self.style.SUCCESS(f"Published {count} items"))

    def _serialize(self, book):
        if book.content_type == Book.ContentType.BOOK:
            return self._serialize_book(book)
        return self._serialize_article(book)

    def _serialize_book(self, book):
        pages = list(book.pages.values("page", "text", "audio"))
        for p in pages:
            p["audio"] = p["audio"] or None
        return {
            "id": book.id,
            "type": "book",
            "title": book.title,
            "cover": book.cover.name if book.cover else None,
            "reference_text_ar": book.reference_ar or None,
            "reference_text_id": book.reference_id or None,
            "pages": pages,
            "reward": {
                "coins": book.reward_coins,
            },
        }

    def _serialize_article(self, book):
        sections = []
        for s in book.sections.all():
            sec = {"type": s.type, "text": s.text}
            if s.type == "list":
                sec = {"type": "list", "items": s.items}
            sections.append(sec)

        quizzes = []
        for q in book.quizzes.all():
            quiz = {
                "type": q.type,
                "question": q.question,
                "answer": q.answer,
                "explanation": q.explanation,
            }
            if q.options:
                quiz["options"] = q.options
            quizzes.append(quiz)

        return {
            "id": book.id,
            "type": "article",
            "title": book.title,
            "source": book.source,
            "category": book.categories,
            "sections": sections,
            "quiz": quizzes,
            "reward": {
                "coins": book.reward_coins,
                "maxStars": 4,
            },
        }

    def _rebuild_manifest(self, published_dir):
        published = Book.objects.filter(is_published=True)
        manifest = {
            "version": max((b.published_version for b in published), default=0),
            "updated_at": timezone.now().isoformat(),
            "books": [],
            "articles": [],
        }

        for book in published:
            entry = {
                "id": book.id,
                "title": book.title,
                "version": book.published_version,
                "min_age": book.min_age,
                "categories": book.categories,
            }
            if book.content_type == Book.ContentType.BOOK:
                manifest["books"].append(entry)
            else:
                manifest["articles"].append(entry)

        with open(published_dir / "manifest.json", "w") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        self.stdout.write(f"  Manifest: {len(manifest['books'])} books, {len(manifest['articles'])} articles")
