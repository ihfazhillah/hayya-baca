"""Server-side EN-AU speech synthesis for user-created lessons (MeloTTS).

MeloTTS requires Python 3.10–3.12; the Django gunicorn venv is 3.14. So this
module is only ever *executed* by the `generate_pending_audio` worker running
under the separate `.venv-melo` (3.12) interpreter — see Spec 064 / plan.md.
The heavy imports are lazy so merely importing this module (e.g. in the 3.14
test/gunicorn process) is safe; only `render_mp3()` touches MeloTTS + ffmpeg.
"""

import os
import subprocess
import tempfile
import threading

# EN-AU synthesis speed (MeloTTS `speed`); a touch slower than native for
# language learners. Matches tools/english-pipeline defaults.
DEFAULT_SPEED = float(os.environ.get("ENGLISH_TTS_SPEED", "0.9"))

_model = None
_speaker_id = None
_lock = threading.Lock()


class TtsUnavailable(Exception):
    """MeloTTS is not importable in this interpreter (wrong venv?)."""


def _get_model():
    global _model, _speaker_id
    with _lock:
        if _model is None:
            try:
                from melo.api import TTS
            except ImportError as e:  # pragma: no cover - env-specific
                raise TtsUnavailable(
                    "Gagal import MeloTTS di worker venv (.venv-melo, Python "
                    f"3.10). Penyebab: {e}"
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


def render_mp3(text: str, speed: float = DEFAULT_SPEED) -> bytes:
    """Synthesize `text` in EN-AU and return mono 24kHz mp3 bytes."""
    model, speaker_id = _get_model()
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "seg.wav")
        mp3 = os.path.join(d, "seg.mp3")
        model.tts_to_file(text, speaker_id, wav, speed=speed, quiet=True)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
             "-ac", "1", "-ar", "24000", "-b:a", "64k", mp3],
            check=True, capture_output=True,
        )
        with open(mp3, "rb") as f:
            return f.read()
