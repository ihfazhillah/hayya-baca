# Spec 073 — Lesson shadowing dari YouTube (audio asli)

## Masalah
Lesson English sekarang lahir dari dua jalur: (a) **teks custom** di SPA → audio
EN-AU via worker TTS, atau (b) pipeline **offline** `tools/english-pipeline/make_lesson.py`
mode `youtube` yang di-import manual (`import_english_lesson`). Tidak ada jalur
**live**: user tak bisa sekadar paste URL YouTube di aplikasi dan dapat latihan.

## Tujuan
User paste URL YouTube di SPA → server unduh audio, ambil transkrip, potong per
segmen, judul auto → lesson **READY** untuk shadowing. Model/scoring/player reuse
yang sudah ada. `EnglishLesson.source=YOUTUBE` + `source_url` sudah tersedia.

## Keputusan (disepakati)
- **Audio = ASLI video** (bukan TTS EN-AU) → butuh `yt-dlp`+`ffmpeg` (+`faster-whisper`
  fallback) di server. Suara penutur asli, latihan menyimak otentik.
- **Judul = AUTO** dari metadata video (YouTube **oEmbed**, ringan, sinkron di request).
- **Default non-publik** (audio berhak cipta) — `is_public=False`, user bisa ubah nanti.
- **Cap durasi 20 menit** (`MAX_DURATION_S=1200`, sama seperti pipeline offline).
- **Worker venv = reuse deps pipeline offline** + Django (lihat Deploy).

## Arsitektur
- Logika inti diangkat dari `make_lesson.py` ke modul reusable
  **`backend/english/youtube.py`**: `extract_video_id`, `fetch_transcript`,
  `merge_entries`, `to_mp3`, `oembed_title`. Pipeline offline & worker live berbagi
  kode (make_lesson.py jadi thin wrapper — fase 3).
- **Create (sinkron, ringan)** — `POST /api/english/lessons/` mode youtube:
  validasi URL + `extract_video_id` + `oembed_title` (timeout pendek) → buat
  `EnglishLesson(owner, source=YOUTUBE, source_url, title, audio_status=PENDING)`
  **tanpa segmen**. Balik cepat; SPA polling status "diproses".
- **Worker baru `ingest_pending_youtube --loop`** (mirror `generate_pending_audio`),
  filter `source=YOUTUBE` + status PENDING/PROCESSING, idempotent & resumable:
  1. `yt-dlp` bestaudio (match-filter `duration<=1200`, `--no-playlist`) → tempdir.
  2. transkrip: `youtube_transcript_api` (en/en-AU/en-GB/en-US); **fallback**
     `faster-whisper` base int8 kalau tak ada caption.
  3. `merge_entries` ~8 dtk; **chunk per ~15 kata** kalau caption tanpa tanda baca.
  4. `ffmpeg` potong tiap segmen dari full audio → mp3 mono 24k; simpan
     `EnglishSegment(order, text, audio, duration_s)`.
  5. `READY`. Lebih dari `MAX_SEGMENTS` → FAILED + pesan jelas.
  Error apa pun (privat/panjang/tanpa caption+whisper gagal/IP diblokir) → FAILED,
  `error` ditampilkan di SPA.
- **TTS worker `generate_pending_audio`**: tambah filter `source=CUSTOM` supaya tak
  menyentuh lesson YouTube (cegah race: lesson YOUTUBE PENDING tanpa segmen jangan
  ke-mark READY oleh worker TTS).

## Frontend
- `CreateLesson.tsx`: toggle **Teks / YouTube**. Mode YouTube: input URL; field judul
  auto (opsional override). `api.ts createLesson` terima `source_url`.

## Deploy (prod)
- **Reuse venv UTAMA `.venv` (3.14)** — worker TTS sudah jalan di sana (Spec 071) dan
  venv itu sudah punya `faster-whisper` (group `stt`, fallback transcribe). Cukup
  tambah group `youtube` (`yt-dlp` + `youtube-transcript-api`):
  `uv sync --group production --group tts --group stt --group youtube` (production
  WAJIB, prune gotcha). `ffmpeg` = system binary (sudah ada, dipakai TTS/transcode).
  **Tak perlu migration** — `source`/`source_url`/`Source.YOUTUBE` sudah ada.
- systemd **`english-youtube.service`** (`deploy/english-youtube.service`, mirror
  `english-tts.service`) → `manage.py ingest_pending_youtube --loop`.
- SPA rebuild + rsync (toggle YouTube di CreateLesson).
- systemd **`english-youtube.service`** (mirror `english-tts.service`): `--loop`,
  `PYTHONPATH` ke backend, WorkingDirectory netral.
- `whisper base int8` (~150 MB) hanya untuk fallback; warm sekali. RAM 2 GB + swap 3 GB
  cukup (yt-dlp+ffmpeg ringan; whisper jarang).

## Rollout (tiap fase butuh approval)
1. **Fase 1 (kode, no deploy):** `youtube.py`, serializer create mode youtube +
   oEmbed, worker `ingest_pending_youtube`, filter `source` di TTS worker, toggle SPA.
   Test lengkap (mock yt-dlp/transcript/oembed/ffmpeg).
2. **Fase 2 (deploy):** venv + ffmpeg/yt-dlp + service unit; smoke 1 video nyata;
   verifikasi caption path & whisper fallback.
3. **Fase 3 (opsional):** proxy/cookies kalau IP diblokir; rate-limit per user;
   `make_lesson.py` jadi thin wrapper atas `youtube.py`.

## Test (use-case level)
- Backend (mock): create youtube → lesson PENDING + judul dari oEmbed; worker sukses
  (mock yt-dlp+transcript+ffmpeg) → segmen + READY; tanpa caption → whisper fallback
  dipanggil; video panjang → FAILED/reject; URL invalid → 400; **TTS worker mengabaikan
  source=youtube**.
- Frontend: toggle YouTube kirim `source_url`; sukses → redirect list "diproses".
- 1 smoke nyata saat deploy.

## Risiko & mitigasi
- **YouTube blokir IP datacenter** (yt-dlp/transcript) — risiko utama. Mitigasi: pesan
  error jelas + fallback paste teks manual (fitur existing); fase 3 proxy/cookies.
- **Hak cipta** audio asli — pemakaian pribadi/edukasi; default non-publik; keputusan user.
- **Beban server** — worker terpisah, cap 20 mnt, whisper fallback saja, resumable.
- **Race PENDING** custom vs youtube — dipisah via filter `source` di kedua worker.
- **oEmbed gagal** (privat) — timeout pendek + judul fallback / tolak; jangan hang gunicorn.
