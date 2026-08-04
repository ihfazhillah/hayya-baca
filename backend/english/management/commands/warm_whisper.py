"""Muat (dan unduh bila perlu) model faster-whisper sekarang, bukan saat
request pertama user. Jalankan sekali setelah deploy / ganti WHISPER_SIZE:

    uv run python manage.py warm_whisper
"""

from django.core.management.base import BaseCommand, CommandError

from english.transcribe import WHISPER_SIZE, SttUnavailable, _get_model


class Command(BaseCommand):
    help = "Pre-load model faster-whisper (unduh saat pertama, lalu cache lokal)"

    def handle(self, *args, **opts):
        try:
            _get_model()
        except SttUnavailable as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f"Model whisper '{WHISPER_SIZE}' siap."))
