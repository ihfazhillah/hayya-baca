"""MCP server exposing Hayya Baca English lesson tools to Claude.

Tools:
  - add_lesson(title, text, level?, is_public?)  → create a custom lesson
  - list_lessons()                               → all visible lessons + audio progress
  - get_lesson_status(lesson_id)                 → one lesson's audio state (x/y)

Config (env):
  ENGLISH_API_BASE   backend base URL          (default http://localhost:8123)
  ENGLISH_API_TOKEN  DRF service token         (REQUIRED)
  MCP_BEARER_TOKEN   inbound gate for claude.ai (optional; if unset → no auth)
  MCP_HOST / MCP_PORT / MCP_PATH  HTTP bind     (default 127.0.0.1 : 8130 : /mcp)

Run (HTTP, for claude.ai / remote):   python server.py
Run over stdio (local Claude Desktop): python server.py --stdio
"""

from __future__ import annotations

import os
import sys

import httpx
from fastmcp import FastMCP

import api

BASE = os.environ.get("ENGLISH_API_BASE", "http://localhost:8123")
TOKEN = os.environ.get("ENGLISH_API_TOKEN")
BEARER = os.environ.get("MCP_BEARER_TOKEN")


def _build_auth():
    """Static bearer gate for claude.ai (header-token). None → no inbound auth."""
    if not BEARER:
        return None
    from fastmcp.server.auth.providers.jwt import StaticTokenVerifier

    return StaticTokenVerifier(tokens={BEARER: {"client_id": "claude-connector"}})


mcp = FastMCP("hayya-baca-english", auth=_build_auth())


def _client() -> httpx.Client:
    if not TOKEN:
        raise RuntimeError("ENGLISH_API_TOKEN belum di-set (DRF token akun layanan).")
    return api.make_client(BASE, TOKEN)


def _detail(exc: httpx.HTTPStatusError) -> str:
    """Surface the backend's error message instead of a bare status code."""
    try:
        data = exc.response.json()
    except Exception:
        return exc.response.text or str(exc)
    if isinstance(data, dict):
        return "; ".join(f"{k}: {v}" for k, v in data.items())
    return str(data)


@mcp.tool
def add_lesson(
    title: str, text: str, level: str = "beginner", is_public: bool = False
) -> dict:
    """Buat lesson English baru dari satu blok teks.

    Teks dipecah jadi kalimat (segmen) oleh backend, lalu audio aksen EN-AU
    di-generate async oleh worker di server. Segera setelah dibuat, status masih
    'pending/processing' — pakai get_lesson_status untuk memantau progres x/y.

    Args:
        title: judul lesson.
        text: isi teks (satu atau beberapa kalimat/paragraf).
        level: 'beginner' | 'intermediate' | 'advanced'.
        is_public: True agar terlihat pengguna lain; default privat.
    """
    if level not in api.LEVELS:
        return {"ok": False, "error": f"level harus salah satu dari {api.LEVELS}"}
    try:
        with _client() as c:
            data = api.add_lesson(
                c, title=title, text=text, level=level, is_public=is_public
            )
    except httpx.HTTPStatusError as e:
        return {"ok": False, "error": _detail(e)}
    return {
        "ok": True,
        "id": data.get("id"),
        "title": data.get("title", title),
        "message": "Lesson dibuat. Audio EN-AU sedang di-generate di server.",
    }


@mcp.tool
def list_lessons() -> list[dict]:
    """Daftar semua lesson yang terlihat, beserta progres generate audio (x/y)."""
    with _client() as c:
        rows = api.list_lessons(c)
    return [
        {
            "id": l["id"],
            "title": l["title"],
            "level": l.get("level"),
            "is_public": l.get("is_public"),
            "audio": api.audio_progress(l),
        }
        for l in rows
    ]


@mcp.tool
def get_lesson_status(lesson_id: int) -> dict:
    """Status satu lesson: state audio + progres segmen yang sudah ter-generate."""
    try:
        with _client() as c:
            l = api.get_lesson(c, lesson_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"ok": False, "error": f"Lesson {lesson_id} tidak ditemukan."}
        return {"ok": False, "error": _detail(e)}
    total = len(l.get("segments", []))
    ready = l.get("audio_ready_count", 0)
    return {
        "ok": True,
        "id": l["id"],
        "title": l["title"],
        "audio_status": l.get("audio_status"),
        "audio_ready_count": ready,
        "segment_count": total,
        "progress": api.audio_progress(l),
    }


def main() -> None:
    if "--stdio" in sys.argv:
        mcp.run()  # stdio transport (local Claude Desktop / Code)
        return
    mcp.run(
        transport="http",
        host=os.environ.get("MCP_HOST", "127.0.0.1"),
        port=int(os.environ.get("MCP_PORT", "8130")),
        path=os.environ.get("MCP_PATH", "/mcp"),
    )


if __name__ == "__main__":
    main()
