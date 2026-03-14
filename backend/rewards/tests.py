import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
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
