# english-web

Frontend web (React 19 + Vite + Tailwind 4) untuk modul English Practice — melengkapi layar React Native di `app/english/`. Pola sama dengan `diary-web`: SPA di-serve nginx, `/api/` di-proxy ke gunicorn Django yang sama (tanpa CORS).

## Dev

```bash
cd english-web
npm install
npm run dev   # proxy /api → http://localhost:8123 (Django dev)
```

## Auth & visibilitas (Spec 064)

- **Login wajib** — masuk dengan akun guardian Hayya Baca (username + password → `POST /api/auth/login/`, DRF token disimpan di `localStorage['english.token']`). 401 dari request apa pun otomatis logout. Akun anak menyusul nanti.
- **Visibilitas lesson** — daftar menampilkan lesson **milik sendiri** ∪ **publik (ready)** ∪ **admin-published**. Lesson privat orang lain tak terlihat (detail → 404, tidak bocor).
- **Buat Lesson** — user mengetik teks English → server memecah jadi segmen dan **worker MeloTTS (venv 3.12, `english-tts.service`)** mensintesis audio EN-AU async. Status `pending → processing → ready`; UI polling sampai siap. Bisa ditandai **publik**.
- **Audio terproteksi** — `audio_url` memakai URL bertanda-tangan `?t=` + `X-Accel-Redirect`; audio privat tak bisa diunduh langsung dari `/media/`.

## Fitur & kompatibilitas browser

- **Lessons** — daftar & player lesson dari `/api/english/lessons/`. Audio segmen adalah mp3 MeloTTS EN-AU dari server, jadi aksennya Australia di semua browser.
- **Teks Sendiri** — TTS via Web Speech API dengan preferensi voice `en-AU`. Edge dan Chrome Android punya voice en-AU asli; desktop Chrome bisa jatuh ke voice English generik (ada peringatan di UI).
- **Dikte & Shadowing** — TANPA webkitSpeechRecognition. Suara direkam via MediaRecorder lalu diunggah ke `POST /api/english/transcribe/` (faster-whisper `base` int8 di Django yang sama). Jalan di semua browser modern termasuk Firefox. Backend perlu `uv sync --group stt` dan sekali `uv run python manage.py warm_whisper` setelah deploy.
- Scoring identik dengan app RN (`src/lib/english.ts`): LCS + fuzzball threshold 85, jadi skor konsisten lintas platform.

## Build & deploy

```bash
npm run build          # hasil di dist/
# deploy: lihat deploy/english.nginx.conf (pola sama dengan ruangcerita)
```
