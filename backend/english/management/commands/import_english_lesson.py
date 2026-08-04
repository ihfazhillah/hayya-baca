"""Import an English lesson folder produced by tools/english-pipeline.

Expected folder layout:
    lesson-folder/
      lesson.json           # {title, source, source_url, level, segments: [...]}
      segments/000.mp3 ...

Usage:
    uv run python manage.py import_english_lesson ../tools/english-pipeline/out/my-lesson
    uv run python manage.py import_english_lesson <folder> --publish
"""

import json
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from english.models import EnglishLesson, EnglishSegment


class Command(BaseCommand):
    help = "Import lesson folder (lesson.json + segments/*.mp3) dari english-pipeline"

    def add_arguments(self, parser):
        parser.add_argument("folder", type=str)
        parser.add_argument(
            "--publish", action="store_true", help="Langsung publish setelah import"
        )

    def handle(self, *args, **opts):
        folder = Path(opts["folder"]).resolve()
        meta_path = folder / "lesson.json"
        if not meta_path.exists():
            raise CommandError(f"lesson.json tidak ditemukan di {folder}")

        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        for key in ("title", "source", "segments"):
            if key not in meta:
                raise CommandError(f"lesson.json tidak punya field '{key}'")

        lesson, created = EnglishLesson.objects.update_or_create(
            slug=meta.get("slug") or None,
            defaults={
                "title": meta["title"],
                "source": meta["source"],
                "source_url": meta.get("source_url", ""),
                "level": meta.get("level", EnglishLesson.Level.BEGINNER),
            },
        )
        if not created:
            lesson.segments.all().delete()  # re-import replaces segments

        for i, seg in enumerate(meta["segments"]):
            audio_path = folder / seg["audio"]
            if not audio_path.exists():
                raise CommandError(f"Audio tidak ditemukan: {audio_path}")
            with audio_path.open("rb") as f:
                segment = EnglishSegment(
                    lesson=lesson,
                    order=i,
                    text=seg["text"],
                    duration_s=float(seg.get("duration", 0)),
                )
                segment.audio.save(
                    f"{lesson.slug}-{i:03d}{audio_path.suffix}", File(f), save=True
                )

        if opts["publish"]:
            lesson.is_published = True
            lesson.published_at = timezone.now()
            lesson.save(update_fields=["is_published", "published_at"])

        verb = "dibuat" if created else "diupdate"
        self.stdout.write(
            self.style.SUCCESS(
                f"Lesson '{lesson.title}' {verb} — {lesson.segments.count()} segmen"
                + (" (published)" if opts["publish"] else " (draft)")
            )
        )
