"""EN-AU speech synthesis for user-created lessons (Spec 071 dispatcher).

`render_mp3()` picks a TTS provider (see `english.tts_providers`) — default
Edge-TTS (free, light, EN-AU), with configurable fallbacks — then normalizes
the raw audio to mono 24 kHz mp3 with ffmpeg. The `generate_pending_audio`
worker calls this once per segment.
"""

import os
import subprocess

from english.tts_providers import synthesize

# Synthesis speed (a touch slower than native for learners).
DEFAULT_SPEED = float(os.environ.get("ENGLISH_TTS_SPEED", "0.9"))


def _to_mp3(raw: bytes) -> bytes:
    """Transcode raw audio (mp3/wav bytes) → mono 24 kHz 64 kbit mp3."""
    proc = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0",
         "-ac", "1", "-ar", "24000", "-b:a", "64k", "-f", "mp3", "pipe:1"],
        input=raw,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg gagal: {proc.stderr.decode()[:200]}")
    return proc.stdout


def render_mp3(text: str, speed: float = DEFAULT_SPEED) -> bytes:
    """Synthesize `text` via the configured provider → mono 24 kHz mp3 bytes."""
    raw, _provider = synthesize(text, speed=speed)
    return _to_mp3(raw)
