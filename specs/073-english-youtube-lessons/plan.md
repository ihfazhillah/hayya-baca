# Plan 073 — implementasi

## Fase 1 — kode (no deploy)

### 1. `backend/english/youtube.py` (baru)
Modul reusable, diangkat dari `tools/english-pipeline/make_lesson.py` (tanpa
argparse/MeloTTS). Import berat (`yt_dlp`/`faster_whisper`) dilakukan **lazy di dalam
fungsi**, supaya modul bisa di-import di venv utama (untuk test yang di-mock) tanpa deps.
- `extract_video_id(url) -> str | None`
- `oembed_title(url, *, timeout=5) -> str | None` — GET `https://www.youtube.com/oembed?url=...&format=json` (stdlib urllib + User-Agent), balik `title`; None kalau gagal.
- `fetch_transcript(video_id) -> list[dict] | None` — youtube_transcript_api v1.x/0.6.x.
- `merge_entries(entries, target_len=8.0)` + `chunk_untimed(text, words=15)` untuk caption tanpa tanda baca.
- `download_audio(url, dst_dir) -> Path` — yt-dlp bestaudio wav, match-filter `duration<=MAX_DURATION_S`.
- `to_mp3(src, dst, start, end)` — ffmpeg (port apa adanya).
- `whisper_transcribe(wav) -> list[dict]` — faster-whisper base int8 (lazy import).
- `MAX_DURATION_S=1200`.

### 2. `backend/english/serializers.py`
`EnglishLessonCreateSerializer`: `text` & `source_url` jadi **opsional**; validasi
**tepat satu** yang diisi.
- `validate()`: kalau `source_url` → `extract_video_id` (invalid → ValidationError);
  `oembed_title` untuk default `title` kalau title kosong.
- `create()`: cabang youtube → `EnglishLesson(source=YOUTUBE, source_url, title,
  audio_status=PENDING, is_public=False default)` **tanpa segmen**. Cabang custom → seperti sekarang.

### 3. `backend/english/management/commands/ingest_pending_youtube.py` (baru)
Mirror `generate_pending_audio`: `--loop/--interval`, filter `source=YOUTUBE` +
status PENDING/PROCESSING, idempotent (skip lesson yang sudah punya segmen bila resume).
Alur per lesson: download_audio → fetch_transcript (else whisper) → merge/chunk →
cap `MAX_SEGMENTS` (lebih → FAILED) → `to_mp3` per segmen → `EnglishSegment.objects`
simpan audio+text+duration → READY. Exception → FAILED + `error`.

### 4. `backend/english/management/commands/generate_pending_audio.py`
Tambah `.filter(source=EnglishLesson.Source.CUSTOM)` di `_process_batch` — TTS worker
hanya sentuh lesson custom.

### 5. Frontend
- `english-web/src/api.ts` `createLesson`: terima `{ source_url?: string; text?: string }`.
- `english-web/src/pages/CreateLesson.tsx`: toggle **Teks / YouTube**. Mode YouTube:
  input URL (judul opsional; kalau kosong server isi dari oEmbed).

## Fase 2 — deploy (nanti, approval terpisah)
venv reuse pipeline offline + Django; `ffmpeg`/`yt-dlp`; systemd `english-youtube.service`;
warm whisper; smoke 1 video nyata.

## Fase 3 — opsional
proxy/cookies bila IP diblokir; rate-limit; `make_lesson.py` jadi wrapper `youtube.py`.

## Titik reuse (tak berubah)
Model, player, scoring, list-polling "diproses", signed audio URL, import command.
