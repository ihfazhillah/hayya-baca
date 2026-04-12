from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from library.models import Book
from reading.models import ReadingLog
from search.models import SearchLog, SearchSuggestion


User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="parent", password="pw")


@pytest.fixture
def child(db, user):
    c = Child.objects.create(name="Ahmad", created_by=user)
    ChildAccess.objects.create(user=user, child=c, role=ChildAccess.Role.PARENT)
    return c


@pytest.fixture
def api(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def make_book(db):
    def _make(title, slug, content_type="book", categories=None, published=True):
        return Book.objects.create(
            title=title,
            slug=slug,
            content_type=content_type,
            is_published=published,
            categories=categories or [],
        )

    return _make


class TestSearchRanking:
    def test_exact_title_scores_100(self, api, make_book):
        make_book("Nabi Muhammad", "nabi-muhammad")
        resp = api.get("/api/search/?q=Nabi Muhammad")
        assert resp.status_code == 200
        assert resp.data["results"][0]["score"] == 100

    def test_prefix_scores_50(self, api, make_book):
        make_book("Nabi Muhammad Saw", "nms")
        resp = api.get("/api/search/?q=Nabi")
        assert resp.data["results"][0]["score"] == 50

    def test_contains_scores_25(self, api, make_book):
        make_book("Kisah Nabi Ibrahim", "kni")
        resp = api.get("/api/search/?q=Nabi")
        # "Kisah Nabi Ibrahim" contains "nabi" but does not start with it → 25
        assert resp.data["results"][0]["score"] == 25

    def test_category_match_scores_10(self, api, make_book):
        make_book("Tentang Singa", "tentang-singa", categories=["Hewan"])
        resp = api.get("/api/search/?q=Hewan")
        # title doesn't contain "hewan" but category does → 10
        top = resp.data["results"][0]
        assert top["score"] == 10

    def test_already_read_boost_5(self, api, make_book, child):
        make_book("Nabi Muhammad", "nabi-muhammad")
        ReadingLog.objects.create(
            child=child,
            book_id="nabi-muhammad",
            completed_at=timezone.now(),
            idempotency_key="k1",
        )
        resp = api.get(f"/api/search/?q=Nabi Muhammad&child_id={child.id}")
        assert resp.data["results"][0]["score"] == 105
        assert resp.data["results"][0]["already_read"] is True

    def test_sort_by_score_then_updated_at(self, api, make_book):
        make_book("Nabi Muhammad", "nm1")
        make_book("Kisah Nabi", "nm2")
        resp = api.get("/api/search/?q=Nabi")
        scores = [r["score"] for r in resp.data["results"]]
        assert scores == sorted(scores, reverse=True)
        assert resp.data["results"][0]["slug"] == "nm1"  # exact-prefix wins

    def test_caps_at_30(self, api, make_book):
        for i in range(35):
            make_book(f"Nabi {i}", f"nabi-{i}")
        resp = api.get("/api/search/?q=Nabi")
        assert len(resp.data["results"]) == 30

    def test_filter_score_zero_excluded(self, api, make_book):
        make_book("Something Else", "se")
        resp = api.get("/api/search/?q=xyz")
        assert resp.data["total"] == 0

    def test_mixed_book_article(self, api, make_book):
        make_book("Nabi Book", "nb", content_type="book")
        make_book("Nabi Article", "na", content_type="article")
        resp = api.get("/api/search/?q=Nabi")
        types = {r["type"] for r in resp.data["results"]}
        assert types == {"book", "article"}

    def test_requires_auth(self, db, make_book):
        make_book("Nabi", "nabi")
        resp = APIClient().get("/api/search/?q=Nabi")
        assert resp.status_code in (401, 403)


class TestSuggest:
    def test_empty_returns_top_user_queries(self, api, db):
        SearchSuggestion.objects.create(
            phrase="popular 1", source="user_query", weight=10
        )
        SearchSuggestion.objects.create(
            phrase="popular 2", source="user_query", weight=5
        )
        SearchSuggestion.objects.create(
            phrase="ngram phrase", source="ngram_title", weight=100
        )
        resp = api.get("/api/search/suggest/?q=")
        phrases = [s["phrase"] for s in resp.data["suggestions"]]
        assert "popular 1" in phrases
        assert "ngram phrase" not in phrases
        assert phrases[0] == "popular 1"

    def test_prefix_matches_ngram_and_user(self, api, db):
        SearchSuggestion.objects.create(
            phrase="nabi muhammad", source="ngram_title", weight=2.0
        )
        SearchSuggestion.objects.create(
            phrase="nabi ibrahim", source="user_query", weight=3.0
        )
        SearchSuggestion.objects.create(
            phrase="sahabat", source="ngram_title", weight=1.0
        )
        resp = api.get("/api/search/suggest/?q=nabi")
        phrases = [s["phrase"] for s in resp.data["suggestions"]]
        assert "nabi muhammad" in phrases
        assert "nabi ibrahim" in phrases
        assert "sahabat" not in phrases


class TestSearchLogCreate:
    def test_log_click_creates_row(self, api, child):
        resp = api.post(
            "/api/search/log/",
            {
                "child_id": child.id,
                "query": "nabi",
                "result_slug": "nabi-muhammad",
                "result_type": "book",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert SearchLog.objects.count() == 1

    def test_log_requires_auth(self, db, child):
        resp = APIClient().post(
            "/api/search/log/",
            {
                "child_id": child.id,
                "query": "nabi",
                "result_slug": "x",
                "result_type": "book",
            },
            format="json",
        )
        assert resp.status_code in (401, 403)

    def test_log_rejects_other_users_child(self, db, make_book):
        owner = User.objects.create_user(username="a", password="pw")
        other = User.objects.create_user(username="b", password="pw")
        c = Child.objects.create(name="X", created_by=owner)
        ChildAccess.objects.create(user=owner, child=c, role=ChildAccess.Role.PARENT)
        client = APIClient()
        client.force_authenticate(user=other)
        resp = client.post(
            "/api/search/log/",
            {"child_id": c.id, "query": "q", "result_slug": "s", "result_type": "book"},
            format="json",
        )
        assert resp.status_code == 403


class TestGenerateSuggestionsCommand:
    def test_idempotent(self, db, make_book):
        make_book("Nabi Muhammad", "nm")
        make_book("Kisah Para Sahabat", "kps")
        call_command("generate_search_suggestions", stdout=StringIO())
        first = set(
            SearchSuggestion.objects.values_list("phrase", "source", "weight")
        )
        call_command("generate_search_suggestions", stdout=StringIO())
        second = set(
            SearchSuggestion.objects.values_list("phrase", "source", "weight")
        )
        assert first == second

    def test_generates_ngrams_from_titles(self, db, make_book):
        make_book("Nabi Muhammad", "nm")
        call_command("generate_search_suggestions", stdout=StringIO())
        phrases = set(
            SearchSuggestion.objects.filter(source="ngram_title").values_list(
                "phrase", flat=True
            )
        )
        assert "nabi" in phrases
        assert "nabi muhammad" in phrases

    def test_aggregates_user_queries(self, db, make_book, child):
        make_book("Nabi", "n")
        now = timezone.now()
        for _ in range(3):
            SearchLog.objects.create(
                child=child, query="nabi", result_slug="n", result_type="book"
            )
        call_command("generate_search_suggestions", stdout=StringIO())
        assert SearchSuggestion.objects.filter(
            source="user_query", phrase="nabi"
        ).exists()
