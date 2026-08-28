"""Ingest YouTube lessons: download the original audio, transcribe, cut segments.

Spec 073. Runs under a venv with yt-dlp + faster-whisper (+ ffmpeg system binary)
— see specs/073. Mirrors `generate_pending_audio`: idempotent, resumable, one
lesson at a time, failures recorded per-lesson so the batch continues.

    python manage.py ingest_pending_youtube          # one pass
    python manage.py ingest_pending_youtube --loop    # long-running worker
"""

import shutil
import tempfile
import time
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from english import youtube
from english.models import EnglishLesson, EnglishSegment
from english.serializers import MAX_SEGMENTS


class Command(BaseCommand):
    help = "Download + segment YouTube lessons from their original audio."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="Poll forever.")
        parser.add_argument(
            "--interval", type=float, default=10.0, help="Poll seconds (--loop)."
        )

    def handle(self, *args, **opts):
        if opts["loop"]:
            self.stdout.write("english-youtube worker: polling…")
            while True:
                self._process_batch()
                time.sleep(opts["interval"])
        else:
            n = self._process_batch()
            self.stdout.write(self.style.SUCCESS(f"Selesai — {n} lesson diproses."))

    def _process_batch(self) -> int:
        S = EnglishLesson.Status
        pending = EnglishLesson.objects.filter(
            source=EnglishLesson.Source.YOUTUBE,
            audio_status__in=[S.PENDING, S.PROCESSING],
        ).order_by("created_at")
        count = 0
        for lesson in pending:
            self._process_lesson(lesson)
            count += 1
        return count

    def _process_lesson(self, lesson: EnglishLesson):
        S = EnglishLesson.Status
        lesson.audio_status = S.PROCESSING
        lesson.error = ""
        lesson.save(update_fields=["audio_status", "error", "updated_at"])
        # Clean slate: a crash mid-cut can leave partial segments; delete them so
        # we never mark a half-cut lesson READY.
        lesson.segments.all().delete()
        tmp = Path(tempfile.mkdtemp(prefix="yt_"))
        try:
            vid = youtube.extract_video_id(lesson.source_url)
            if not vid:
                raise RuntimeError("URL YouTube tidak valid.")
            wav = youtube.download_audio(lesson.source_url, tmp)
            entries = youtube.fetch_transcript(vid)
            if not entries:
                entries = youtube.whisper_transcribe(wav)
            entries = youtube.merge_entries(entries or [])
            entries = [e for e in entries if e["text"].strip()]
            if not entries:
                raise RuntimeError("Transkrip kosong / tidak tersedia.")
            if len(entries) > MAX_SEGMENTS:
                raise RuntimeError(
                    f"Video terlalu panjang: {len(entries)} segmen (maks {MAX_SEGMENTS})."
                )
            for i, e in enumerate(entries):
                mp3 = tmp / f"{i:03d}.mp3"
                youtube.to_mp3(wav, mp3, start=e["start"], end=e["end"])
                seg = EnglishSegment(
                    lesson=lesson,
                    order=i,
                    text=e["text"].strip(),
                    duration_s=round(e["end"] - e["start"], 2),
                )
                seg.audio.save(
                    f"{lesson.slug}-{i:03d}.mp3",
                    ContentFile(mp3.read_bytes()),
                    save=True,
                )
            lesson.audio_status = S.READY
            lesson.save(update_fields=["audio_status", "updated_at"])
            self.stdout.write(
                self.style.SUCCESS(f"✓ {lesson.slug} ({len(entries)} seg)")
            )
        except Exception as e:  # noqa: BLE001 — record & continue to next lesson
            lesson.audio_status = S.FAILED
            lesson.error = str(e)[:2000]
            lesson.save(update_fields=["audio_status", "error", "updated_at"])
            self.stderr.write(f"✗ {lesson.slug}: {e}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
