"""Use-case tests for the English MCP tools.

Hermetic: the Django API is faked with httpx.MockTransport, so no live backend
is needed. Covers the three user journeys (add / list / status) plus the
progress formatter and error surfacing.
"""

import httpx
import pytest

import api
import server


def make_mock_client(handler):
    return httpx.Client(
        base_url="http://test",
        headers={"Authorization": "Token svc"},
        transport=httpx.MockTransport(handler),
    )


# ---- api layer: request shape ------------------------------------------------

def test_add_lesson_posts_expected_payload():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"] = str(req.url)
        seen["auth"] = req.headers.get("Authorization")
        import json
        seen["body"] = json.loads(req.content)
        return httpx.Response(201, json={"id": 7, "title": "Cafe"})

    with make_mock_client(handler) as c:
        out = api.add_lesson(c, title="Cafe", text="Hello. Bye.", level="beginner")

    assert out["id"] == 7
    assert seen["url"].endswith("/api/english/lessons/")
    assert seen["auth"] == "Token svc"
    assert seen["body"] == {
        "title": "Cafe", "text": "Hello. Bye.",
        "level": "beginner", "is_public": False,
    }


# ---- progress formatter ------------------------------------------------------

@pytest.mark.parametrize("lesson,expected", [
    ({"audio_status": "ready"}, "ready"),
    ({"audio_status": "failed"}, "failed"),
    ({"audio_status": "processing", "segment_count": 20, "audio_ready_count": 9}, "processing 9/20"),
    ({"audio_status": "pending", "segments": [1, 2, 3], "audio_ready_count": 0}, "pending 0/3"),
])
def test_audio_progress(lesson, expected):
    assert api.audio_progress(lesson) == expected


# ---- server tools ------------------------------------------------------------

def patch_client(monkeypatch, handler):
    monkeypatch.setattr(server, "_client", lambda: make_mock_client(handler))


def test_tool_add_lesson_ok(monkeypatch):
    def handler(req):
        return httpx.Response(201, json={"id": 42, "title": "Zoo"})
    patch_client(monkeypatch, handler)

    out = server.add_lesson("Zoo", "The zoo is fun.")
    assert out["ok"] is True
    assert out["id"] == 42


def test_tool_add_lesson_rejects_bad_level():
    out = server.add_lesson("X", "Hi.", level="expert")
    assert out["ok"] is False
    assert "level" in out["error"]


def test_tool_add_lesson_surfaces_backend_400(monkeypatch):
    def handler(req):
        return httpx.Response(400, json={"text": ["Teks tidak boleh kosong."]})
    patch_client(monkeypatch, handler)

    out = server.add_lesson("X", "   ")
    assert out["ok"] is False
    assert "Teks tidak boleh kosong." in out["error"]


def test_tool_list_lessons_maps_progress(monkeypatch):
    def handler(req):
        return httpx.Response(200, json=[
            {"id": 1, "title": "A", "level": "beginner", "is_public": True,
             "audio_status": "processing", "segment_count": 20, "audio_ready_count": 9},
            {"id": 2, "title": "B", "level": "advanced", "is_public": False,
             "audio_status": "ready", "segment_count": 5, "audio_ready_count": 5},
        ])
    patch_client(monkeypatch, handler)

    rows = server.list_lessons()
    assert rows[0]["audio"] == "processing 9/20"
    assert rows[1]["audio"] == "ready"


def test_tool_get_status_reports_counts(monkeypatch):
    def handler(req):
        return httpx.Response(200, json={
            "id": 3, "title": "C", "audio_status": "processing",
            "audio_ready_count": 8, "segments": [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
        })
    patch_client(monkeypatch, handler)

    out = server.get_lesson_status(3)
    assert out["ok"] is True
    assert out["audio_ready_count"] == 8
    assert out["segment_count"] == 10
    assert out["progress"] == "processing 8/10"


def test_tool_get_status_404(monkeypatch):
    def handler(req):
        return httpx.Response(404, json={"detail": "Not found."})
    patch_client(monkeypatch, handler)

    out = server.get_lesson_status(999)
    assert out["ok"] is False
    assert "999" in out["error"]
