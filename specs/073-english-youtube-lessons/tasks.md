# Tasks 073

## Fase 1 — kode (test-first) ✅ SELESAI (71 english tests hijau)
- [x] Test backend (mock): create youtube → PENDING + judul oEmbed; URL invalid → 400; tolak text+url sekaligus; title eksplisit skip oEmbed
- [x] Test backend (mock): `ingest_pending_youtube` sukses (mock download/transcript/ffmpeg) → segmen + READY
- [x] Test backend (mock): tanpa caption → whisper fallback dipanggil
- [x] Test backend (mock): > MAX_SEGMENTS → FAILED
- [x] Test backend: TTS worker `generate_pending_audio` mengabaikan source=youtube
- [x] `backend/english/youtube.py` (refactor dari make_lesson, lazy imports)
- [x] `EnglishLessonCreateSerializer` terima source_url (validasi tepat-satu, oEmbed title, youtube→non-publik)
- [x] `ingest_pending_youtube` management command (idempotent, clean-slate on retry)
- [x] filter `source=CUSTOM` di `generate_pending_audio`
- [x] `api.ts createLesson` + `CreateLesson.tsx` toggle YouTube
- [x] dependency-group `youtube` (yt-dlp + youtube-transcript-api) di backend pyproject

## Fase 2 — deploy (approval terpisah)
- [ ] venv worker (reuse deps pipeline + Django) di prod
- [ ] ffmpeg + yt-dlp tersedia; warm whisper
- [ ] systemd `english-youtube.service` + enable
- [ ] smoke 1 video nyata (caption + fallback whisper)

## Fase 3 — opsional
- [ ] proxy/cookies fallback bila IP diblokir
- [ ] rate-limit per user
- [ ] `make_lesson.py` → wrapper `youtube.py`
