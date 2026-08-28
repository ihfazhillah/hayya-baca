"""YouTube ingestion helpers for the English module (Spec 073).

Shared by the offline pipeline (tools/english-pipeline/make_lesson.py) and the
live worker `ingest_pending_youtube`. Heavy deps (yt_dlp, faster_whisper,
youtube_transcript_api) are imported LAZILY inside functions, so this module
imports fine in the backend venv where they may be absent — the tests mock these
functions, so the lazy imports never run under test.
"""

import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

MAX_DURATION_S = 1200  # skip videos longer than 20 minutes


def extract_video_id(url: str | None) -> str | None:
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([0-9A-Za-z_-]{11})", url or "")
    return m.group(1) if m else None


def oembed_title(url: str, *, timeout: float = 5.0) -> str | None:
    """Video title via YouTube oEmbed (no API key). None on any failure."""
    endpoint = "https://www.youtube.com/oembed?" + urllib.parse.urlencode(
        {"url": url, "format": "json"}
    )
    try:
        req = urllib.request.Request(endpoint, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return (data.get("title") or "").strip() or None
    except Exception:
        return None


def fetch_transcript(video_id: str) -> list[dict] | None:
    """YouTube captions as [{start, end, text}], or None when unavailable."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        langs = ["en", "en-AU", "en-GB", "en-US"]
        try:  # v1.x
            fetched = YouTubeTranscriptApi().fetch(video_id, languages=langs)
            entries = [
                {"start": s.start, "end": s.start + s.duration, "text": s.text}
                for s in fetched
            ]
        except AttributeError:  # 0.6.x
            raw = YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
            entries = [
                {"start": e["start"], "end": e["start"] + e["duration"], "text": e["text"]}
                for e in raw
            ]
        entries = [
            e for e in entries if e["text"].strip() and not e["text"].startswith("[")
        ]
        return entries or None
    except Exception:
        return None


def download_audio(url: str, dst_dir: Path) -> Path:
    """yt-dlp bestaudio → audio.wav in dst_dir. Raises on failure / too-long video."""
    out = dst_dir / "audio.%(ext)s"
    res = subprocess.run(
        [
            "yt-dlp", "-f", "bestaudio/best", "--extract-audio", "--audio-format", "wav",
            "--match-filter", f"duration <= {MAX_DURATION_S}", "--no-playlist",
            "-o", str(out), url,
        ],
        capture_output=True, text=True,
    )
    wav = dst_dir / "audio.wav"
    if res.returncode != 0 or not wav.exists():
        raise RuntimeError(
            "yt-dlp gagal (video privat/terlalu panjang/IP diblokir): "
            + res.stderr[-400:]
        )
    return wav


def whisper_transcribe(wav: Path) -> list[dict]:
    """Local fallback transcription when a video has no captions."""
    from faster_whisper import WhisperModel

    model = WhisperModel("base", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(wav), language="en", vad_filter=True)
    return [
        {"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
        for s in segs
    ]


def merge_entries(entries: list[dict], target_len: float = 8.0) -> list[dict]:
    """Merge caption lines into ~target_len second, sentence-aware segments."""
    merged: list[dict] = []
    cur: dict | None = None
    for e in entries:
        if cur is None:
            cur = dict(e)
            continue
        dur = cur["end"] - cur["start"]
        ends = cur["text"].rstrip().endswith((".", "?", "!"))
        if dur >= target_len or (ends and dur >= 3.0):
            merged.append(cur)
            cur = dict(e)
        else:
            cur["text"] = cur["text"].rstrip() + " " + e["text"].lstrip()
            cur["end"] = e["end"]
    if cur:
        merged.append(cur)
    return merged


def to_mp3(src: Path, dst: Path, start: float | None = None, end: float | None = None):
    """Cut [start, end] (with small pad) from src → mono 24 kHz mp3 at dst."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    if start is not None:
        pad = 0.15
        cmd += [
            "-ss", f"{max(0, start - pad):.2f}",
            "-t", f"{max(0.5, (end or start) - start + 2 * pad):.2f}",
        ]
    cmd += ["-i", str(src), "-ac", "1", "-ar", "24000", "-b:a", "64k", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True)
