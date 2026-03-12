"""Import articles from JSON files into the database."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from library.models import ArticleSection, Book, Quiz


class Command(BaseCommand):
    help = "Import articles from JSON files"

    def add_arguments(self, parser):
        parser.add_argument(
            "path",
            help="Path to articles directory or single JSON file",
        )

    def handle(self, *args, **options):
        path = Path(options["path"])

        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = sorted(path.glob("*.json"))
        else:
            self.stderr.write(f"Not found: {path}")
            return

        imported = 0
        for f in files:
            with open(f) as fh:
                data = json.load(fh)

            book, created = Book.objects.update_or_create(
                title=data["title"],
                content_type=Book.ContentType.ARTICLE,
                defaults={
                    "source": data.get("source", ""),
                    "source_url": data.get("url", ""),
                    "categories": data.get("category", []),
                    "min_age": 6,
                    "reward_coins": data.get("reward", {}).get("coins", 1),
                },
            )

            if not created:
                book.sections.all().delete()
                book.quizzes.all().delete()

            # Import sections
            sections = data.get("sections")
            if sections:
                # Structured sections
                for i, sec in enumerate(sections):
                    ArticleSection.objects.create(
                        book=book,
                        order=i,
                        type=sec["type"],
                        text=sec.get("text", ""),
                        items=sec.get("items", []),
                    )
            elif data.get("content"):
                # Raw content string — split into paragraphs
                for i, paragraph in enumerate(data["content"].split("\n\n")):
                    paragraph = paragraph.strip()
                    if not paragraph:
                        continue
                    ArticleSection.objects.create(
                        book=book,
                        order=i,
                        type=ArticleSection.SectionType.PARAGRAPH,
                        text=paragraph,
                    )

            # Import quiz
            for i, q in enumerate(data.get("quiz", [])):
                Quiz.objects.create(
                    book=book,
                    order=i,
                    type=q["type"],
                    question=q["question"],
                    options=q.get("options", []),
                    answer=q["answer"],
                    explanation=q.get("explanation", ""),
                )

            action = "Created" if created else "Updated"
            sections_count = book.sections.count()
            quiz_count = book.quizzes.count()
            self.stdout.write(
                f"  {action}: {book.title} ({sections_count} sections, {quiz_count} quiz)"
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported {imported} articles"))
