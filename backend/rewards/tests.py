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
