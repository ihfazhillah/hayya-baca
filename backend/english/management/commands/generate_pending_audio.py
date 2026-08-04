"""Generate EN-AU audio for user-created English lessons (MeloTTS worker).

Run under the separate Python 3.12 venv (.venv-melo) that has MeloTTS installed
— NOT the backend 3.14 venv. Deployed as the `english-tts.service` systemd unit.

    # one pass (e.g. cron/manual)
    .venv-melo/bin/python manage.py generate_pending_audio
    # long-running worker
    .venv-melo/bin/python manage.py generate_pending_audio --loop

Idempotent & resumable: only segments still missing audio are synthesized, and
a lesson left in `processing` by a crash is retried on the next pass.
"""

import time

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from english import tts
from english.models import EnglishLesson


class Command(BaseCommand):
    help = "Synthesize EN-AU audio for pending English lessons (MeloTTS)."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="Poll forever.")
        parser.add_argument(
            "--interval", type=float, default=5.0, help="Poll seconds (--loop)."
        )

    def handle(self, *args, **opts):
        if opts["loop"]:
            self.stdout.write("english-tts worker: polling…")
            while True:
                self._process_batch()
                time.sleep(opts["interval"])
        else:
            n = self._process_batch()
            self.stdout.write(self.style.SUCCESS(f"Selesai — {n} lesson diproses."))

    def _process_batch(self) -> int:
        S = EnglishLesson.Status
        pending = EnglishLesson.objects.filter(
            audio_status__in=[S.PENDING, S.PROCESSING]
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
        try:
            for seg in lesson.segments.all():
                if seg.audio:
                    continue  # resume: skip already-synthesized segments
                data = tts.render_mp3(seg.text)
                seg.audio.save(
                    f"{lesson.slug}-{seg.order:03d}.mp3",
                    ContentFile(data),
                    save=True,
                )
            lesson.audio_status = S.READY
            lesson.save(update_fields=["audio_status", "updated_at"])
            self.stdout.write(self.style.SUCCESS(f"✓ {lesson.slug}"))
        except Exception as e:  # noqa: BLE001 — record & continue to next lesson
            lesson.audio_status = S.FAILED
            lesson.error = str(e)[:2000]
            lesson.save(update_fields=["audio_status", "error", "updated_at"])
            self.stderr.write(f"✗ {lesson.slug}: {e}")
