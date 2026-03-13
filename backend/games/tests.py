import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from .models import Game, GameSession

User = get_user_model()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


@pytest.fixture
def child(parent):
    child = Child.objects.create(name="Ahmad", age=5, created_by=parent, coins=20)
    ChildAccess.objects.create(user=parent, child=child, role="parent")
    return child


@pytest.fixture
def auth_api(parent):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=parent)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.fixture
def game(db):
    return Game.objects.create(
        slug="test-game", title="Test Game", icon="🎮",
        coin_cost=2, session_minutes=5, is_published=True,
    )


class TestGameList:
    def test_list_published(self, game):
        api = APIClient()
        resp = api.get("/api/games/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["slug"] == "test-game"

    def test_excludes_unpublished(self, db):
        Game.objects.create(slug="draft", title="Draft", icon="🎮", is_published=False)
        api = APIClient()
        resp = api.get("/api/games/")
        assert len(resp.data) == 0

    def test_detail(self, game):
        api = APIClient()
        resp = api.get("/api/games/test-game/")
        assert resp.status_code == 200
        assert resp.data["title"] == "Test Game"


class TestPlayGame:
    def test_play_deducts_coins(self, auth_api, child, game):
        resp = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        assert resp.status_code == 201
        assert resp.data["coins_spent"] == 2
        assert resp.data["expires_at"] is not None
        child.refresh_from_db()
        assert child.coins == 18

    def test_play_insufficient_coins(self, auth_api, child, game):
        child.coins = 1
        child.save(update_fields=["coins"])
        resp = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        assert resp.status_code == 402

    def test_play_unauthenticated(self, game):
        api = APIClient()
        resp = api.post("/api/games/test-game/play/", {"child_id": 1})
        assert resp.status_code == 401

    def test_play_wrong_child(self, auth_api, game, db):
        resp = auth_api.post("/api/games/test-game/play/", {"child_id": 9999})
        assert resp.status_code == 404

    def test_play_returns_active_session(self, auth_api, child, game):
        # First play → 201
        r1 = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        assert r1.status_code == 201
        # Second play → 200 (same session, no double deduction)
        r2 = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        assert r2.status_code == 200
        assert r2.data["id"] == r1.data["id"]
        child.refresh_from_db()
        assert child.coins == 18  # deducted only once


class TestExtendGame:
    def test_extend_session(self, auth_api, child, game):
        play_resp = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        original_expires = play_resp.data["expires_at"]

        resp = auth_api.post("/api/games/test-game/extend/", {"child_id": child.id})
        assert resp.status_code == 200
        assert resp.data["coins_spent"] == 4
        assert resp.data["expires_at"] > original_expires
        child.refresh_from_db()
        assert child.coins == 16

    def test_extend_no_active_session(self, auth_api, child, game):
        resp = auth_api.post("/api/games/test-game/extend/", {"child_id": child.id})
        assert resp.status_code == 404


class TestEndSession:
    def test_end_with_score(self, auth_api, child, game):
        play_resp = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        session_id = play_resp.data["id"]

        resp = auth_api.post(f"/api/games/sessions/{session_id}/end/", {"score": 150})
        assert resp.status_code == 200
        assert resp.data["score"] == 150
        assert resp.data["ended_at"] is not None

    def test_end_without_score(self, auth_api, child, game):
        play_resp = auth_api.post("/api/games/test-game/play/", {"child_id": child.id})
        session_id = play_resp.data["id"]

        resp = auth_api.post(f"/api/games/sessions/{session_id}/end/", {})
        assert resp.status_code == 200
        assert resp.data["score"] is None
