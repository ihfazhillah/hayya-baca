import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from library.models import Book

User = get_user_model()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


@pytest.fixture
def child(parent):
    child = Child.objects.create(name="Ahmad", age=5, created_by=parent)
    ChildAccess.objects.create(user=parent, child=child, role="parent")
    return child


@pytest.fixture
def book(db):
    return Book.objects.create(
        title="Test Book", slug="test-book", content_type="book", is_published=True
    )


@pytest.fixture
def article(db):
    return Book.objects.create(
        title="Test Article", slug="test-article", content_type="article", is_published=True
    )


@pytest.fixture
def auth_api(parent):
    client = APIClient()
    token, _ = Token.objects.get_or_create(user=parent)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


class TestReadingProgress:
    def test_create_progress(self, auth_api, child, book):
        resp = auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 5, "completed": False
        })
        assert resp.status_code == 201
        assert resp.data["last_page"] == 5

    def test_upsert_progress(self, auth_api, child, book):
        auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 3
        })
        resp = auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 8, "completed": True
        })
        assert resp.status_code == 201
        assert resp.data["last_page"] == 8
        assert resp.data["completed"] is True

    def test_list_progress(self, auth_api, child, book, article):
        auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 3
        })
        auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": article.slug, "last_page": 1, "completed": True
        })
        resp = auth_api.get(f"/api/children/{child.id}/progress/")
        assert resp.status_code == 200
        assert len(resp.data) == 2

    def test_unauthenticated(self, child):
        api = APIClient()
        resp = api.get(f"/api/children/{child.id}/progress/")
        assert resp.status_code == 401


class TestProgressMaxMerge:
    """Reading progress should use max() — never go backward."""

    def test_last_page_uses_max(self, auth_api, child, book):
        # First push: page 10
        auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 10
        })
        # Second push: page 5 (older data from another device)
        resp = auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 5
        })
        assert resp.status_code == 201
        assert resp.data["last_page"] == 10  # should keep 10, not regress to 5

    def test_completed_count_uses_max(self, auth_api, child, book):
        auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 10,
            "completed": True, "completed_count": 3
        })
        resp = auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 5,
            "completed": False, "completed_count": 1
        })
        assert resp.data["last_page"] == 10
        assert resp.data["completed_count"] == 3
        assert resp.data["completed"] is True  # once completed, stays completed

    def test_forward_progress_accepted(self, auth_api, child, book):
        auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 5
        })
        resp = auth_api.post(f"/api/children/{child.id}/progress/", {
            "child": child.id, "book": book.slug, "last_page": 10
        })
        assert resp.data["last_page"] == 10  # forward progress accepted

    def test_source_device_stored(self, auth_api, child, book):
        from reading.models import ReadingProgress

        auth_api.post(
            f"/api/children/{child.id}/progress/",
            {"child": child.id, "book": book.slug, "last_page": 5},
            HTTP_X_DEVICE_ID="tablet-123",
        )
        progress = ReadingProgress.objects.get(child=child, book=book)
        assert progress.source_device == "tablet-123"


class TestQuizAttempt:
    def test_submit_perfect_score(self, auth_api, child, article):
        resp = auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 4, "total": 4
        })
        assert resp.status_code == 201
        assert resp.data["stars_earned"] == 4
        child.refresh_from_db()
        assert child.stars == 4

    def test_submit_75_percent(self, auth_api, child, article):
        resp = auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 3, "total": 4
        })
        assert resp.data["stars_earned"] == 3

    def test_submit_50_percent(self, auth_api, child, article):
        resp = auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 2, "total": 4
        })
        assert resp.data["stars_earned"] == 2

    def test_submit_25_percent(self, auth_api, child, article):
        resp = auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 1, "total": 4
        })
        assert resp.data["stars_earned"] == 1

    def test_submit_zero(self, auth_api, child, article):
        resp = auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 0, "total": 4
        })
        assert resp.data["stars_earned"] == 0

    def test_stars_accumulate(self, auth_api, child, article):
        auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 4, "total": 4
        })
        auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 4, "total": 4
        })
        child.refresh_from_db()
        assert child.stars == 8

    def test_list_attempts(self, auth_api, child, article):
        auth_api.post(f"/api/children/{child.id}/quiz-attempts/", {
            "child": child.id, "book": article.slug, "score": 3, "total": 4
        })
        resp = auth_api.get(f"/api/children/{child.id}/quiz-attempts/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
