"""Edge-TTS provider — Microsoft Edge online neural voices (Spec 071).

Free, no API key, very light (HTTP/websocket to Microsoft). Default voice is
Australian to match the lesson accent. Output is already mono 24 kHz mp3.
`edge-tts` is unofficial, so keep a fallback configured (see registry).
"""

import asyncio
import os

from .base import TtsError, speed_to_rate

DEFAULT_VOICE = "en-AU-NatashaNeural"


class EdgeProvider:
    name = "edge"

    def __init__(self, voice: str | None = None):
        self.voice = voice or os.environ.get("ENGLISH_TTS_VOICE") or DEFAULT_VOICE

    def synthesize(self, text: str, *, speed: float = 1.0) -> bytes:
        try:
            import edge_tts
        except ImportError as e:  # pragma: no cover - env-specific
            raise TtsError(
                "edge-tts belum terinstall. Jalankan: uv sync --group tts"
            ) from e

        rate = speed_to_rate(speed)

        async def _run() -> bytes:
            communicate = edge_tts.Communicate(text, self.voice, rate=rate)
            buf = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf += chunk["data"]
            return bytes(buf)

        try:
            data = asyncio.run(_run())
        except Exception as e:  # noqa: BLE001 - normalize to TtsError
            raise TtsError(f"Edge-TTS gagal: {e}") from e
        if not data:
            raise TtsError("Edge-TTS mengembalikan audio kosong")
        return data
