import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.management import call_command

from accounts.models import Child, ChildAccess
from .models import SyncLog

User = get_user_model()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


@pytest.fixture
def child(parent):
    child = Child.objects.create(name="Ahmad", age=5, created_by=parent)
    ChildAccess.objects.create(user=parent, child=child, role="parent")
    return child


class TestSyncLogCleanup:
    def test_old_logs_deleted(self, parent, child):
        # Create old log (31 days ago)
        old = SyncLog.objects.create(
            user=parent, device_id="dev-1", child=child,
            action="push_rewards", item_count=5,
        )
        SyncLog.objects.filter(pk=old.pk).update(
            timestamp=timezone.now() - timedelta(days=31)
        )

        # Create recent log
        SyncLog.objects.create(
            user=parent, device_id="dev-1", child=child,
            action="push_rewards", item_count=3,
        )

        call_command("cleanup_sync_logs")

        assert SyncLog.objects.count() == 1
        assert SyncLog.objects.first().item_count == 3

    def test_recent_logs_kept(self, parent, child):
        SyncLog.objects.create(
            user=parent, device_id="dev-1", child=child,
            action="push_rewards", item_count=5,
        )
        call_command("cleanup_sync_logs")
        assert SyncLog.objects.count() == 1
