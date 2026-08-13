"""Provider selection + fallback chain (Spec 071).

Config via env:
    ENGLISH_TTS_PROVIDER    active provider (default 'edge')
    ENGLISH_TTS_FALLBACKS   comma-separated fallbacks, e.g. 'melo'
    ENGLISH_TTS_VOICE       provider-specific voice (Edge default en-AU)
"""

import logging
import os

from .base import TtsError
from .edge import EdgeProvider
from .melo import MeloProvider

logger = logging.getLogger(__name__)

_PROVIDERS = {
    EdgeProvider.name: EdgeProvider,
    MeloProvider.name: MeloProvider,
}


def _make(name: str):
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise TtsError(f"Provider TTS tak dikenal: {name!r}")
    return cls()


def _chain() -> list[str]:
    active = os.environ.get("ENGLISH_TTS_PROVIDER", "edge").strip() or "edge"
    fallbacks = [
        n.strip()
        for n in os.environ.get("ENGLISH_TTS_FALLBACKS", "").split(",")
        if n.strip()
    ]
    # De-dup while keeping order.
    seen, chain = set(), []
    for name in [active, *fallbacks]:
        if name not in seen:
            seen.add(name)
            chain.append(name)
    return chain


def synthesize(text: str, *, speed: float = 1.0) -> tuple[bytes, str]:
    """Try the active provider then each fallback. → (raw_audio_bytes, provider)."""
    last: Exception | None = None
    for name in _chain():
        try:
            data = _make(name).synthesize(text, speed=speed)
            return data, name
        except Exception as e:  # noqa: BLE001 - try next provider
            last = e
            logger.warning("TTS provider %s gagal: %s", name, e)
    raise TtsError(f"Semua provider TTS gagal: {last}")
