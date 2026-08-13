"""Thin client for the Hayya Baca English REST API.

Kept separate from the FastMCP wiring in `server.py` so the request/response
logic can be unit-tested with `httpx.MockTransport` (no live backend needed).

Auth to Django is a single DRF service token (one guardian account); every
lesson is created as that account. See README.
"""

from __future__ import annotations

import httpx

DEFAULT_TIMEOUT = 30.0
LEVELS = ("beginner", "intermediate", "advanced")


def make_client(
    base_url: str, token: str, *, timeout: float = DEFAULT_TIMEOUT, **kwargs
) -> httpx.Client:
    """httpx client pre-authenticated with the DRF service token."""
    return httpx.Client(
        base_url=base_url.rstrip("/"),
        headers={"Authorization": f"Token {token}"},
        timeout=timeout,
        **kwargs,
    )


def add_lesson(
    client: httpx.Client,
    *,
    title: str,
    text: str,
    level: str = "beginner",
    is_public: bool = False,
) -> dict:
    """POST a new custom lesson. Audio EN-AU is generated async by the worker."""
    r = client.post(
        "/api/english/lessons/",
        json={"title": title, "text": text, "level": level, "is_public": is_public},
    )
    r.raise_for_status()
    return r.json()


def list_lessons(client: httpx.Client) -> list[dict]:
    r = client.get("/api/english/lessons/")
    r.raise_for_status()
    return r.json()


def get_lesson(client: httpx.Client, lesson_id: int) -> dict:
    r = client.get(f"/api/english/lessons/{lesson_id}/")
    r.raise_for_status()
    return r.json()


def audio_progress(lesson: dict) -> str:
    """Human string for audio generation state, e.g. 'processing 9/20', 'ready'.

    Works for both list rows (segment_count) and detail (segments[])."""
    status = lesson.get("audio_status", "unknown")
    if status in ("ready", "failed"):
        return status
    total = lesson.get("segment_count")
    if total is None:
        total = len(lesson.get("segments", []))
    ready = lesson.get("audio_ready_count", 0)
    return f"{status} {ready}/{total}"
