# Spec 071 — Pluggable TTS providers (offload MeloTTS)

## Masalah
Audio lesson (aksen EN-AU) di-generate server-side oleh **MeloTTS**
(`english-tts.service`, venv terpisah `.venv-melo`, ~1.4 GB RAM). Di server 2 GB
ini bikin **swap penuh & thrashing**: lesson 16 segmen bisa mangkrak berjam-jam,
worker masuk state `D` (nunggu disk), CPU ~0%. MeloTTS terlalu berat untuk box ini.

## Tujuan
Offload sintesis TTS ke layanan cloud yang **ringan** lewat abstraksi **provider
yang bisa dicolok**: admin cukup **masukkan API key + pilih model/voice**. Mulai
dengan provider gratis & ringan, pertahankan aksen EN-AU semampunya, dan
**pensiunkan MeloTTS dari jalur panas** → bebaskan ~1.4 GB permanen.

> Catatan: **Groq TTS sudah decommissioned** (`playai-tts` mati; tak ada model TTS
> lain di Groq). Groq tetap dipakai untuk **STT** (Spec Groq STT terpisah), TIDAK
> untuk TTS. Jadi default TTS bukan Groq.

## Katalog provider (rekomendasi)

| Provider | Gratis | Key | Aksen EN-AU | Beban server | Catatan |
|---|---|---|---|---|---|
| **Edge-TTS** ⭐ default | ✅ total | ❌ tanpa key | ✅ `en-AU-NatashaNeural`, `en-AU-WilliamNeural` | sangat ringan (HTTP/ws ke MS) | Lib `edge-tts`. Tak resmi (ToS abu-abu, bisa berubah) → pakai fallback |
| **Google Cloud TTS** | ✅ free tier (~1 jt char/bln Neural2) | ✅ service-account JSON | ✅ banyak voice en-AU | ringan (HTTP) | Resmi, kualitas tinggi, kuota jelas |
| **ElevenLabs** | ⚠️ ~10k char/bln | ✅ | via pilihan voice | ringan | Kualitas top, kuota kecil |
| **OpenAI `tts-1`** | ❌ murah | ✅ | tak spesifik AU | ringan | Cadangan |
| **MeloTTS (lokal)** | ✅ | ❌ | ✅ EN-AU | **berat** (1.4 GB) | Yang sekarang; jadi fallback offline, **OFF by default** |

**Default v1: Edge-TTS** (paling pas "gratis + lega + AU"), dengan fallback ke
Google (kalau dikonfigurasi) lalu MeloTTS lokal (kalau diaktifkan).

## Arsitektur
- Paket baru `backend/english/tts_providers/`:
  - `base.py` — `Protocol TtsProvider`: `name`, `synthesize(text, *, voice, speed) -> bytes` (wav/mp3 mentah).
  - satu modul per provider: `edge.py`, `google.py`, `eleven.py`, `melo.py` (bungkus `tts.render_mp3` lama).
  - `registry.py` — pilih provider aktif + urutan fallback dari env; instansiasi baca key/voice env.
- `english/tts.py`: `render_mp3(text)` jadi **dispatcher** → provider aktif → normalisasi **ffmpeg ke mp3 mono 24 kHz** (langkah ffmpeg yang sudah ada dipertahankan) → fallback chain kalau error/limit.
- Worker `generate_pending_audio --loop` **tak berubah** (tetap panggil `render_mp3`, tetap resumable). Karena provider cloud ringan, worker bisa jalan di **venv utama (3.14)** → tak perlu `.venv-melo` di jalur panas.

## Konfigurasi (v1 = env; v2 = admin UI opsional)
```
ENGLISH_TTS_PROVIDER=edge            # edge|google|eleven|openai|melo
ENGLISH_TTS_FALLBACKS=google,melo    # opsional, urutan cadangan
ENGLISH_TTS_VOICE=en-AU-NatashaNeural
# per-provider:
GOOGLE_TTS_KEY=... / GOOGLE_APPLICATION_CREDENTIALS=...
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
```
"Masukkan key + pilih model" terpenuhi lewat env. **v2 opsional**: model/tabel
`TtsConfig` + halaman admin biar bisa ganti tanpa deploy.

## Rollout
1. **Fase 1** — abstraksi provider + **Edge-TTS** + bungkus MeloTTS jadi provider
   `melo`. Default `edge`. Test (mock HTTP). Belum sentuh service prod.
2. **Fase 2 (deploy)** — `english-tts.service` diarahkan ke **venv utama** (tanpa
   MeloTTS ter-load) memanggil provider edge. Restart → **bebas ~1.4 GB**.
   Regenerate lesson `pending/failed` yang ada.
3. **Fase 3 (opsional)** — Google TTS provider + admin config UI + pensiunkan
   `.venv-melo` sepenuhnya.

## Test
- Unit (mock HTTP per provider): mapping request/response benar, output mp3 valid
  setelah ffmpeg, dispatcher pilih provider yang benar, **fallback** saat provider
  utama error/limit, dan `render_mp3` tetap balik `bytes`.
- Satu synth **nyata** per provider saat rollout (verifikasi aksen & format).

## Risiko & mitigasi
- **Edge-TTS tak resmi** bisa berubah/putus → fallback ke Google/Melo; log kegagalan.
- **Aksen** beda antar provider → pilih voice en-AU eksplisit; Google/Edge punya AU.
- **Kuota** (Google/ElevenLabs) → fallback chain + log saat limit.
- **Nama voice beda-beda** tiap provider → simpan di config per-provider, bukan global tunggal.
