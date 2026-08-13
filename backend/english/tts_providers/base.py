"""TTS provider abstraction (Spec 071).

A provider turns text into raw audio bytes (mp3 or wav); the dispatcher in
`english.tts` normalizes the result to mono 24 kHz mp3 via ffmpeg. Providers
read their own voice/key from env so adding one is self-contained.
"""

from typing import Protocol, runtime_checkable


class TtsError(Exception):
    """A TTS provider failed (network, quota, misconfiguration, empty audio)."""


@runtime_checkable
class TtsProvider(Protocol):
    name: str

    def synthesize(self, text: str, *, speed: float = 1.0) -> bytes:
        """Return raw audio bytes for `text`. Raise TtsError on failure."""
        ...


def speed_to_rate(speed: float) -> str:
    """Map a speed multiplier (0.9) to an Edge/SSML-style rate string ("-10%")."""
    return f"{round((speed - 1.0) * 100):+d}%"
