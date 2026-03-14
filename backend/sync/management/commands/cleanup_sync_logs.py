from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from sync.models import SyncLog


class Command(BaseCommand):
    help = "Delete SyncLog entries older than 30 days"

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        count, _ = SyncLog.objects.filter(timestamp__lt=cutoff).delete()
        self.stdout.write(f"Deleted {count} old sync log entries")
