# Hayya Baca - Project Memory

## Evolution
- **Original**: Ksatria Muslim Android (Kotlin, ~2022). Code moved to `old/`.
- **New**: Hayya Baca - React Native port (2026)
- **Current version**: 0.1.0-alpha.1

## App Identity
- **Nama**: Hayya Baca ("Ayo Baca")
- **Package**: com.ihfazh.hayyabaca
- **Repo**: github.com/ihfazhillah/ksatriamuslim-android
- Aplikasi belajar membaca bahasa Indonesia untuk anak-anak Muslim
- Icon: dari app original (old/app/src/main/ic_launcher-playstore.png)

## Target Users
- 5 anak: 2 belum bisa baca, 1 agak lancar, 2 sudah besar
- Orang tua (ayah + ibu) manage via backend (bukan di app anak)

## Architecture Decisions

### Platform & Target
- React Native (Expo SDK 55 / RN 0.83)
- Primary: Android tablet (Android 15-16)
- Secondary: HP biasa (orang tua)

### Data Strategy: Offline-First
- Semua data (progress, points, rewards) simpan lokal dulu
- Sync ke server kalau ada koneksi, kalau tidak pakai lokal
- Konten buku: static JSON files + audio, plain text (bukan gambar)
- Bundled + downloadable content

### Konten Buku
- Format: JSON (raw.json per buku), plain text
- Original 1 kalimat per halaman → di-group jadi paragraf di app baru
- Dibuat sendiri bareng adik & supervisor
- Tema awal: ksatria Islam (sahabat nabi), tapi bisa berkembang
- Font: embed langsung di app

### Speech Recognition
- expo-speech-recognition (wraps native Android SpeechRecognizer)
- Bahasa: id-ID, continuous mode, interim results
- Fuzzy matching (fuzzball, threshold 70%) untuk toleransi pengucapan anak
- Roadmap: custom voice / training sendiri

### Audio & TTS
- Per kata: TTS (expo-speech, id-ID) saat klik kata
- Read-to-me: TTS word-by-word dengan highlight bergerak
- Per halaman: rekaman audio sendiri (hanya book 6 & 10 yang ada)
- TTS fallback kalau audio tidak ada

### Coin/Reward System
- Dapat coin dari membaca buku: ceil(pages/5) per buku selesai
- Star: 1-4 per halaman berdasarkan % kata yang dibaca (>75%=4, >50%=3, >25%=2, >0%=1)
- Leaderboard antar anak (post-MVP)
- Orang tua bisa deduct coin saat kasih hadiah fisik
- Ada minimum coin sebelum bisa redeem
- Histori transaksi tersimpan di SQLite, flag `synced` untuk offline-first

### Display
- Font size auto-adjust berdasarkan umur anak (<=5: besar, <=8: sedang, >8: kecil)
- Tablet vs HP responsive (column count, padding)
- Teks Arab ditampilkan dalam cerita, bisa dengarkan via TTS
- Reference text tersembunyi, bisa dilihat orang tua

### Auto-Update
- Cek GitHub tags otomatis saat app dibuka
- Support semver + pre-release (alpha < beta < rc < stable)
- Download APK dari GitHub releases
- Auto-trigger install setelah download selesai
- build-release.sh: prebuild → gradle → git tag → gh release

## Current Implementation Status

### Done (v0.1.0-alpha.1)
- [x] Project setup (Expo 55, TypeScript, expo-router)
- [x] Pilih profil anak (YouTube Kids style, SQLite)
- [x] Tambah anak baru (nama + umur)
- [x] Perpustakaan buku - 20 buku dengan cover images
- [x] Baca buku - paragraf grouped, navigasi halaman
- [x] Klik kata → TTS per kata (expo-speech, id-ID)
- [x] Read-to-me mode (word-by-word TTS + highlight biru)
- [x] Word highlighting (hijau = sudah dibaca, biru = sedang dibacakan)
- [x] Speech recognition hook (expo-speech-recognition, continuous, fuzzy match)
- [x] Star scoring per halaman
- [x] Coin reward saat selesai buku
- [x] Reading progress tracking (SQLite)
- [x] Reward history (SQLite, synced flag)
- [x] Celebration screen (Alhamdulillah + coin/star animation)
- [x] Auto-update dari GitHub releases (semver + alpha/beta/rc)
- [x] Responsive tablet/HP layout
- [x] Font auto-adjust berdasarkan umur
- [x] Build script (build-release.sh)

### TODO (Post-Alpha)
- [ ] Leaderboard antar anak
- [ ] Book tracking - progress per anak di home screen
- [ ] Ideas/insight tracking (orang tua)
- [ ] Backend sync (REST API polling)
- [ ] Audio playback dari file rekaman (book 6 & 10)
- [ ] Download buku baru dari server
- [ ] Custom font untuk anak belajar baca
- [ ] Onboarding flow

### Dihilangkan dari Original
- Parental control / app timer / overlay
- Firebase (FCM, push notification)
- Microsoft Cognitive Services Speech SDK

## Project Structure

```
ksatriamuslim-android/
├── app/                    # expo-router screens
│   ├── _layout.tsx         # Root (TanStack Query + UpdateProvider)
│   ├── index.tsx           # Pilih profil anak
│   ├── home.tsx            # Grid perpustakaan buku
│   ├── celebrate.tsx       # Selebrasi selesai buku
│   └── read/
│       └── [bookId].tsx    # Baca buku (speech, TTS, highlight)
├── src/
│   ├── components/
│   │   └── UpdateBar.tsx   # Auto-update UI
│   ├── context/
│   │   └── UpdateContext.tsx
│   ├── hooks/
│   │   ├── useChildren.ts  # TanStack Query children CRUD
│   │   ├── useSpeechRecognition.ts  # Speech recognition + fuzzy match
│   │   └── useUpdateCheck.ts        # GitHub releases auto-update
│   ├── lib/
│   │   ├── books.ts        # Load buku dari static JSON, group paragraf
│   │   ├── children.ts     # SQLite children operations
│   │   ├── database.ts     # SQLite schema (children, reading_progress, reward_history)
│   │   ├── rewards.ts      # Coin/star rewards + reading progress
│   │   ├── session.ts      # In-memory selected child
│   │   └── speech.ts       # TTS, fuzzy matching, scoring
│   └── types/
│       ├── index.ts        # Core types
│       └── update.ts       # Update types
├── content/books/          # 20 buku (raw.json + cover + audio)
├── docs/memory.md          # This file
├── old/                    # Original Android app (Kotlin)
├── build-release.sh        # Build + tag + GitHub release
├── app.json                # Expo config
└── package.json
```

## Tech Stack (Actual)
- Expo SDK 55 / React Native 0.83 / TypeScript 5.9
- expo-router (file-based routing)
- @tanstack/react-query (data fetching)
- expo-sqlite (offline-first local DB)
- expo-speech (TTS)
- expo-speech-recognition (native speech recognition)
- expo-av (audio playback - planned)
- expo-file-system + expo-intent-launcher (auto-update)
- fuzzball (fuzzy string matching)
- react-native-reanimated (animations)
- react-native-worklets (reanimated dependency)

## Backend

### Stack
- Django 6.0 (fresh, bukan extend yang lama)
- Django REST Framework
- PostgreSQL
- django.tasks (built-in background tasks, tanpa Celery)
- Celery nanti kalau butuh (ML pipeline, heavy processing)
- Server: 103.186.0.202

### Repo & Structure
- Satu repo: `ksatriamuslim-android/backend/`
- Backend lama (`~/ksatriamuslim_backend/`) akan ditinggalkan

### Apps (planned)
1. **App Anak** (Hayya Baca) - sudah ada
2. **App Orang Tua** - mobile, manage anak, lihat progress, timeline
3. **Backend** - Django, serve kedua app

### Scope Backend
- Sync: children, rewards, reading progress (offline-first dari app)
- Konten: serve/update buku
- Social: timeline keluarga (anak + orang tua)
- Data collection: interaction logs, teks anak tulis, audio bacaan
- Storage: disk server (/media/) untuk audio/gambar

### Data & ML (long-term)
- Collect: interaction data, teks, audio dari anak-anak
- Purpose: belajar ML/DL, NLP, data cleaning
- Pipeline: django.tasks → export → Jupyter/pandas
- Training: di laptop atau server terpisah

## Existing Data (Server - legacy)

### Server
- Host: 103.186.0.202, user: ihfazh
- Django backend lama di ~/ksatriamuslim_backend/ (DRF, Celery)
- 20 buku, 725 halaman, 7 anak, 2358 rewards
- Data buku sudah di-export ke content/books/
