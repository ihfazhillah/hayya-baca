"""Server-side STT untuk speaking/shadowing practice — faster-whisper, CPU.

Berjalan di dalam proses Django (lazy-loaded singleton, per worker gunicorn).
Model default 'base' (int8, ±150 MB RAM) — cukup akurat untuk menilai
kata-per-kata latihan speaking. Ganti via env WHISPER_SIZE=small kalau
server sanggup.

Install dependensi (opsional, dependency group 'stt'):
    uv sync --group stt

Catatan deploy:
- Model diunduh dari Hugging Face saat transkripsi pertama; pastikan server
  bisa akses huggingface.co sekali, setelah itu cache lokal (offline).
- Browser mengirim webm/opus (Chrome/Firefox) atau mp4 (Safari); PyAV
  men-decode semuanya tanpa butuh ffmpeg sistem.
"""

import io
import os
import threading

WHISPER_SIZE = os.environ.get("WHISPER_SIZE", "base")

_model = None
_lock = threading.Lock()


class SttUnavailable(Exception):
    """faster-whisper belum terinstall di environment ini."""


def _get_model():
    global _model
    with _lock:
        if _model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as e:
                raise SttUnavailable(
                    "faster-whisper belum terinstall. Jalankan: uv sync --group stt"
                ) from e
            _model = WhisperModel(WHISPER_SIZE, device="cpu", compute_type="int8")
        return _model


def transcribe_bytes(data: bytes, language: str = "en") -> dict:
    """Transkrip audio (webm/ogg/mp4/wav bytes) → {text, words}.

    Word timestamps (Spec 067 "Salis") feed the pause/rhythm & WPM analysis.
    """
    model = _get_model()
    segments, _info = model.transcribe(
        io.BytesIO(data),
        language=language,
        vad_filter=True,
        beam_size=5,
        word_timestamps=True,
    )
    text_parts: list[str] = []
    words: list[dict] = []
    for seg in segments:
        text_parts.append(seg.text.strip())
        for w in seg.words or []:
            token = w.word.strip()
            if token:
                words.append(
                    {
                        "word": token,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                    }
                )
    return {"text": " ".join(text_parts).strip(), "words": words}
