import json
from io import StringIO
from math import ceil

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from .models import ArticleSection, Book, BookPage, Quiz


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def book(db):
    b = Book.objects.create(
        title="Test Book", slug="test-book", content_type="book", is_published=True, reward_coins=3
    )
    for i in range(1, 4):
        BookPage.objects.create(book=b, page=i, text=f"Page {i} text")
    return b


@pytest.fixture
def article(db):
    b = Book.objects.create(
        title="Test Article",
        slug="test-article",
        content_type="article",
        is_published=True,
        source="test.com",
        categories=["Kisah Nyata"],
        min_age=6,
        reward_coins=1,
    )
    ArticleSection.objects.create(book=b, order=0, type="paragraph", text="Intro text")
    ArticleSection.objects.create(book=b, order=1, type="heading", text="Alkisah")
    ArticleSection.objects.create(book=b, order=2, type="paragraph", text="Story text")
    Quiz.objects.create(
        book=b, order=0, type="multiple_choice",
        question="Test?", options=["A", "B", "C"], answer=1, explanation="Because B"
    )
    return b


class TestBookList:
    def test_list_published(self, api, book):
        resp = api.get("/api/books/")
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_list_excludes_unpublished(self, api, db):
        Book.objects.create(title="Draft", slug="draft", content_type="book", is_published=False)
        resp = api.get("/api/books/")
        assert len(resp.data) == 0

    def test_filter_by_type(self, api, book, article):
        resp = api.get("/api/books/?type=article")
        assert len(resp.data) == 1
        assert resp.data[0]["content_type"] == "article"

    def test_filter_by_category(self, api, article):
        resp = api.get("/api/books/?category=Kisah Nyata")
        assert len(resp.data) == 1

    def test_filter_by_min_age(self, api, book, article):
        resp = api.get("/api/books/?min_age=5")
        assert len(resp.data) == 1

    def test_no_auth_required(self, api, book):
        resp = api.get("/api/books/")
        assert resp.status_code == 200


class TestBookDetail:
    def test_book_detail_with_pages(self, api, book):
        resp = api.get(f"/api/books/{book.id}/")
        assert resp.status_code == 200
        assert len(resp.data["pages"]) == 3
        assert resp.data["sections"] == []
        assert resp.data["quizzes"] == []

    def test_article_detail_with_sections_and_quiz(self, api, article):
        resp = api.get(f"/api/books/{article.id}/")
        assert resp.status_code == 200
        assert len(resp.data["sections"]) == 3
        assert len(resp.data["quizzes"]) == 1
        assert resp.data["quizzes"][0]["answer"] == 1


class TestImportBooks:
    def test_import_books(self, db, tmp_path):
        book_dir = tmp_path / "01-test-book"
        book_dir.mkdir()
        raw = {
            "id": 99,
            "title": "Test Import Book",
            "cover": None,
            "reference_text_ar": "",
            "reference_text_id": "",
            "pages": [
                {"page": 1, "text": "Hello", "audio": None},
                {"page": 2, "text": "World", "audio": None},
            ],
        }
        (book_dir / "raw.json").write_text(json.dumps(raw))

        out = StringIO()
        call_command("import_books", content_dir=str(tmp_path), stdout=out)

        book = Book.objects.get(id=99)
        assert book.title == "Test Import Book"
        assert book.pages.count() == 2
        assert book.reward_coins == ceil(2 / 5)


class TestImportArticles:
    def test_import_article_with_content(self, db, tmp_path):
        article_data = {
            "id": "999",
            "title": "Test Article",
            "source": "test.com",
            "url": "https://test.com/999",
            "category": ["Test"],
            "content": "Paragraph one.\n\nParagraph two.",
            "quiz": [
                {
                    "type": "true_false",
                    "question": "Is this a test?",
                    "answer": True,
                    "explanation": "Yes it is",
                }
            ],
        }
        f = tmp_path / "999-test.json"
        f.write_text(json.dumps(article_data))

        out = StringIO()
        call_command("import_articles", str(tmp_path), stdout=out)

        book = Book.objects.get(title="Test Article")
        assert book.content_type == "article"
        assert book.sections.count() == 2
        assert book.quizzes.count() == 1


class TestPublish:
    def test_publish_book(self, book, tmp_path, settings):
        settings.PUBLISHED_ROOT = tmp_path / "published"
        out = StringIO()
        call_command("publish", ids=[book.id], stdout=out)

        book.refresh_from_db()
        assert book.is_published
        assert book.published_version == 1

        json_file = tmp_path / "published" / "books" / f"{book.id}.json"
        assert json_file.exists()

        data = json.loads(json_file.read_text())
        assert data["title"] == "Test Book"
        assert len(data["pages"]) == 3

        manifest = json.loads((tmp_path / "published" / "manifest.json").read_text())
        assert len(manifest["books"]) == 1

    def test_publish_article(self, article, tmp_path, settings):
        settings.PUBLISHED_ROOT = tmp_path / "published"
        out = StringIO()
        call_command("publish", ids=[article.id], stdout=out)

        json_file = tmp_path / "published" / "articles" / f"{article.id}.json"
        assert json_file.exists()

        data = json.loads(json_file.read_text())
        assert data["type"] == "article"
        assert len(data["sections"]) == 3
        assert len(data["quiz"]) == 1
