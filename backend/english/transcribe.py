"""Server-side STT untuk speaking/shadowing practice.

Dua backend, dipilih otomatis:
- **Groq** (`whisper-large-v3-turbo`, OpenAI-compatible API) kalau `GROQ_API_KEY`
  di-set — cepat, akurat, tanpa beban CPU server. Ini yang utama.
- **faster-whisper** lokal (CPU, model 'base' int8) sebagai fallback kalau Groq
  gagal/limit, atau kalau `GROQ_API_KEY` tidak di-set (perilaku lama).

Keduanya mengembalikan bentuk yang sama: {text, words:[{word,start,end}]}.
Word timestamps (Spec 067 "Salis") memberi analisis jeda/ritme & WPM.

Install faster-whisper (dependency group 'stt'):  uv sync --group stt
"""

import io
import json
import logging
import os
import threading
import urllib.request

logger = logging.getLogger(__name__)

WHISPER_SIZE = os.environ.get("WHISPER_SIZE", "base")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_TIMEOUT = float(os.environ.get("GROQ_TIMEOUT", "30"))

_model = None
_lock = threading.Lock()


class SttUnavailable(Exception):
    """Tidak ada backend STT yang bisa dipakai (Groq off & faster-whisper absent)."""


# --- Groq (utama) ------------------------------------------------------------

def _post_multipart(url, headers, fields, file):
    """POST multipart/form-data via stdlib (no extra dep). → parsed JSON.

    `file` = (field_name, filename, bytes). Raises on non-2xx (urllib does)."""
    boundary = "----hayyabaca" + os.urandom(8).hex()
    buf = io.BytesIO()

    def w(s):
        buf.write(s.encode() if isinstance(s, str) else s)

    for key, val in fields.items():
        w(f"--{boundary}\r\n")
        w(f'Content-Disposition: form-data; name="{key}"\r\n\r\n{val}\r\n')
    fname, filename, blob = file
    w(f"--{boundary}\r\n")
    w(f'Content-Disposition: form-data; name="{fname}"; filename="{filename}"\r\n')
    w("Content-Type: application/octet-stream\r\n\r\n")
    w(blob)
    w(f"\r\n--{boundary}--\r\n")
    req = urllib.request.Request(
        url,
        data=buf.getvalue(),
        method="POST",
        headers={
            **headers,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=GROQ_TIMEOUT) as resp:
        return json.loads(resp.read().decode())


def transcribe_groq(data: bytes, filename: str, language: str = "en") -> dict:
    """Transkrip via Groq Whisper (OpenAI-compatible). → {text, words}."""
    payload = _post_multipart(
        GROQ_URL,
        {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            # Groq is behind Cloudflare, which returns 403 (error 1010) to the
            # default Python-urllib signature; a real UA passes.
            "User-Agent": "hayyabaca-english/1.0",
        },
        {
            "model": GROQ_WHISPER_MODEL,
            "language": language,
            "response_format": "verbose_json",
            "timestamp_granularities[]": "word",
        },
        ("file", filename or "audio.webm", data),
    )
    words = [
        {
            "word": (w.get("word") or "").strip(),
            "start": round(float(w.get("start", 0.0)), 3),
            "end": round(float(w.get("end", 0.0)), 3),
        }
        for w in (payload.get("words") or [])
        if (w.get("word") or "").strip()
    ]
    return {"text": (payload.get("text") or "").strip(), "words": words}


# --- faster-whisper (fallback lokal) -----------------------------------------

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


def transcribe_local(data: bytes, language: str = "en") -> dict:
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


# --- dispatcher --------------------------------------------------------------

def transcribe_bytes(data: bytes, language: str = "en", filename: str = "") -> dict:
    """Groq kalau dikonfigurasi (fallback ke lokal saat gagal); selain itu lokal."""
    if GROQ_API_KEY:
        try:
            return transcribe_groq(data, filename, language)
        except Exception:
            logger.exception("Groq STT gagal, fallback ke faster-whisper lokal")
    return transcribe_local(data, language)
