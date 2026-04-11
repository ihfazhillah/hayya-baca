import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from sync.models import DeviceTelemetry
from .models import RewardHistory

User = get_user_model()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


@pytest.fixture
def child(parent):
    child = Child.objects.create(name="Ahmad", age=5, created_by=parent, coins=10, stars=5)
    ChildAccess.objects.create(user=parent, child=child, role="parent")
    return child


@pytest.fixture
def auth_api(parent):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=parent)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


class TestRewardHistory:
    def test_list_rewards(self, auth_api, child):
        RewardHistory.objects.create(child=child, type="coin", count=3, description="Test")
        resp = auth_api.get(f"/api/children/{child.id}/rewards/")
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_list_empty(self, auth_api, child):
        resp = auth_api.get(f"/api/children/{child.id}/rewards/")
        assert resp.status_code == 200
        assert len(resp.data) == 0


class TestBulkSync:
    def test_sync_rewards(self, auth_api, child):
        resp = auth_api.post(f"/api/children/{child.id}/rewards/sync/", {
            "rewards": [
                {"child": child.id, "type": "coin", "count": 5, "description": "Book done"},
                {"child": child.id, "type": "star", "count": 12, "description": "Stars"},
            ]
        }, format="json")
        assert resp.status_code == 201
        child.refresh_from_db()
        assert child.coins == 15  # 10 + 5
        assert child.stars == 17  # 5 + 12
        assert RewardHistory.objects.filter(child=child, synced=True).count() == 2

    def test_sync_empty(self, auth_api, child):
        resp = auth_api.post(
            f"/api/children/{child.id}/rewards/sync/",
            {"rewards": []}, format="json"
        )
        assert resp.status_code == 201
        child.refresh_from_db()
        assert child.coins == 10


class TestIdempotency:
    def test_same_key_twice_coins_only_once(self, auth_api, child):
        payload = {
            "rewards": [
                {"type": "coin", "count": 5, "description": "Book", "idempotency_key": "dev1:10"},
            ]
        }
        resp1 = auth_api.post(f"/api/children/{child.id}/rewards/sync/", payload, format="json")
        assert resp1.status_code == 201

        resp2 = auth_api.post(f"/api/children/{child.id}/rewards/sync/", payload, format="json")
        assert resp2.status_code == 201

        child.refresh_from_db()
        assert child.coins == 15  # 10 + 5 (not 10 + 5 + 5)
        assert RewardHistory.objects.filter(child=child).count() == 1

    def test_different_keys_both_count(self, auth_api, child):
        auth_api.post(f"/api/children/{child.id}/rewards/sync/", {
            "rewards": [{"type": "coin", "count": 3, "description": "A", "idempotency_key": "dev1:10"}]
        }, format="json")
        auth_api.post(f"/api/children/{child.id}/rewards/sync/", {
            "rewards": [{"type": "coin", "count": 2, "description": "B", "idempotency_key": "dev1:11"}]
        }, format="json")
        child.refresh_from_db()
        assert child.coins == 15  # 10 + 3 + 2

    def test_no_key_always_creates(self, auth_api, child):
        payload = {
            "rewards": [{"type": "coin", "count": 1, "description": "No key"}]
        }
        auth_api.post(f"/api/children/{child.id}/rewards/sync/", payload, format="json")
        auth_api.post(f"/api/children/{child.id}/rewards/sync/", payload, format="json")
        child.refresh_from_db()
        assert child.coins == 12  # 10 + 1 + 1


class TestDeviceTracking:
    def test_device_id_stored(self, auth_api, child):
        auth_api.post(
            f"/api/children/{child.id}/rewards/sync/",
            {"rewards": [{"type": "coin", "count": 1, "description": "Test"}]},
            format="json",
            HTTP_X_DEVICE_ID="device-abc-123",
        )
        reward = RewardHistory.objects.filter(child=child).first()
        assert reward.source_device == "device-abc-123"

    def test_no_device_header_empty_string(self, auth_api, child):
        auth_api.post(
            f"/api/children/{child.id}/rewards/sync/",
            {"rewards": [{"type": "coin", "count": 1, "description": "Test"}]},
            format="json",
        )
        reward = RewardHistory.objects.filter(child=child).first()
        assert reward.source_device == ""


class TestVoidReward:
    def test_void_deducts_coins(self, auth_api, child):
        reward = RewardHistory.objects.create(
            child=child, type="coin", count=5, description="Test", synced=True
        )
        child.coins += 5
        child.save()

        reward.voided = True
        reward.voided_reason = "duplicate"
        reward.save()
        # Simulate admin void action: deduct coins
        child.coins -= reward.count
        child.save()

        child.refresh_from_db()
        assert child.coins == 10  # back to original

    def test_void_star_deducts_stars(self, auth_api, child):
        reward = RewardHistory.objects.create(
            child=child, type="star", count=3, description="Test", synced=True
        )
        child.stars += 3
        child.save()

        reward.voided = True
        reward.save()
        child.stars -= reward.count
        child.save()

        child.refresh_from_db()
        assert child.stars == 5  # back to original


class TestSyncLog:
    def test_sync_creates_log(self, auth_api, child):
        from sync.models import SyncLog

        auth_api.post(
            f"/api/children/{child.id}/rewards/sync/",
            {"rewards": [{"type": "coin", "count": 1, "description": "Test"}]},
            format="json",
            HTTP_X_DEVICE_ID="dev-123",
            HTTP_X_DEVICE_NAME="Test Phone",
        )
        logs = SyncLog.objects.filter(child=child, action="push_rewards")
        assert logs.count() == 1
        log = logs.first()
        assert log.device_id == "dev-123"
        assert log.device_name == "Test Phone"
        assert log.item_count == 1


class TestDeviceTelemetry:
    def test_push_with_telemetry_creates_row(self, auth_api, child, parent):
        resp = auth_api.post(
            f"/api/children/{child.id}/rewards/sync/",
            {
                "rewards": [{"type": "coin", "count": 1, "description": "Test"}],
                "telemetry": {
                    "device_id": "dev-telem-1",
                    "app_version": "1.1.5",
                    "queue_depth_rewards": 3,
                    "queue_depth_progress": 2,
                    "last_successful_sync_at": "2026-04-10T08:00:00Z",
                    "last_sync_error": "",
                },
            },
            format="json",
            HTTP_X_DEVICE_ID="dev-telem-1",
            HTTP_X_DEVICE_NAME="Pixel",
        )
        assert resp.status_code == 201
        row = DeviceTelemetry.objects.get(user=parent, device_id="dev-telem-1")
        assert row.app_version == "1.1.5"
        assert row.queue_depth_rewards == 3
        assert row.queue_depth_progress == 2
        assert row.last_successful_sync_at is not None
        assert row.last_sync_error == ""
        assert row.device_name == "Pixel"

    def test_second_push_upserts_same_device(self, auth_api, child, parent):
        payload_a = {
            "rewards": [{"type": "coin", "count": 1, "description": "A", "idempotency_key": "d1:1"}],
            "telemetry": {"device_id": "dev-x", "queue_depth_rewards": 5, "last_sync_error": "boom"},
        }
        payload_b = {
            "rewards": [{"type": "coin", "count": 1, "description": "B", "idempotency_key": "d1:2"}],
            "telemetry": {"device_id": "dev-x", "queue_depth_rewards": 0, "last_sync_error": ""},
        }
        auth_api.post(f"/api/children/{child.id}/rewards/sync/", payload_a, format="json")
        auth_api.post(f"/api/children/{child.id}/rewards/sync/", payload_b, format="json")

        assert DeviceTelemetry.objects.filter(user=parent, device_id="dev-x").count() == 1
        row = DeviceTelemetry.objects.get(user=parent, device_id="dev-x")
        assert row.queue_depth_rewards == 0
        assert row.last_sync_error == ""

    def test_push_without_telemetry_still_succeeds(self, auth_api, child, parent):
        resp = auth_api.post(
            f"/api/children/{child.id}/rewards/sync/",
            {"rewards": [{"type": "coin", "count": 1, "description": "X"}]},
            format="json",
            HTTP_X_DEVICE_ID="dev-no-telem",
        )
        assert resp.status_code == 201
        # Header-only fallback: view upserts under the header device_id even
        # when the payload omits the telemetry block, so operators still see
        # *something* for older clients.
        assert DeviceTelemetry.objects.filter(user=parent, device_id="dev-no-telem").exists()
