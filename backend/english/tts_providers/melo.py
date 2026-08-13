"""MeloTTS provider — local EN-AU synthesis (Spec 064, now behind Spec 071).

Heavy (~1.4 GB RAM) and needs the separate Python 3.10/3.12 venv (.venv-melo);
kept as an offline fallback only, OFF by default. Returns raw WAV bytes; the
dispatcher transcodes to mp3. Heavy imports are lazy so importing this module in
the 3.14 backend/test process is safe.
"""

import os
import tempfile
import threading

from .base import TtsError

_model = None
_speaker_id = None
_lock = threading.Lock()


def _get_model():
    global _model, _speaker_id
    with _lock:
        if _model is None:
            try:
                from melo.api import TTS
            except ImportError as e:  # pragma: no cover - env-specific
                raise TtsError(
                    "MeloTTS belum terinstall di venv ini (butuh .venv-melo)."
                ) from e
            model = TTS(language="EN", device="cpu")
            spk = model.hps.data.spk2id
            speaker = (
                "EN-AU"
                if "EN-AU" in spk
                else next((k for k in spk if "AU" in k.upper()), next(iter(spk)))
            )
            _model, _speaker_id = model, spk[speaker]
        return _model, _speaker_id


class MeloProvider:
    name = "melo"

    def synthesize(self, text: str, *, speed: float = 1.0) -> bytes:
        try:
            model, speaker_id = _get_model()
            with tempfile.TemporaryDirectory() as d:
                wav = os.path.join(d, "seg.wav")
                model.tts_to_file(text, speaker_id, wav, speed=speed, quiet=True)
                with open(wav, "rb") as f:
                    return f.read()
        except TtsError:
            raise
        except Exception as e:  # noqa: BLE001 - normalize to TtsError
            raise TtsError(f"MeloTTS gagal: {e}") from e
