# Hayya Baca - Project Memory

## Evolution
- **Original**: Ksatria Muslim Android (Kotlin, ~2022). Code moved to `old/`.
- **New**: Hayya Baca - React Native port (2026)
- **Current version**: 1.0.6

## App Identity
- **Nama**: Hayya Baca ("Ayo Baca")
- **Package**: com.ihfazh.hayyabaca
- **Repo**: github.com/ihfazhillah/hayya-baca
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

### Guided Reading Flow (v0.1.0-alpha.3)
Alur membaca sequential, kata per kata:
1. Kata berikutnya di-highlight kuning (target)
2. Anak membaca via mikrofon
3. Kalau cocok (fuzzy match 70%) → hijau (success), lanjut kata berikutnya
4. Kalau salah → max 4 percobaan, lalu skip (kuning pucat/skipped)
5. Semua kata selesai → halaman complete, tombol "Lanjut" aktif
6. Tombol "Lanjut" disabled sampai halaman dibaca (via mic atau "Bacakan")
7. "Bacakan" (read-to-me) juga menyelesaikan halaman

Word status colors:
- **idle**: warna teks biasa
- **target**: kuning (accent) — kata yang harus dibaca
- **success**: hijau — berhasil dibaca
- **skipped**: kuning pucat — di-skip setelah 4x gagal
- **readToMe**: biru — sedang dibacakan TTS

### Speech Recognition
- expo-speech-recognition (wraps native Android SpeechRecognizer)
- Bahasa: id-ID, continuous mode, interim results
- Fuzzy matching (fuzzball, threshold 70%) untuk toleransi pengucapan anak
- Sequential matching — hanya cek kata yang sedang di-target
- Max 4 attempts per kata sebelum auto-skip
- Roadmap: custom voice / training sendiri

### Audio & TTS
- Per kata: TTS (expo-speech, id-ID) saat klik kata
- Read-to-me: TTS word-by-word dengan highlight bergerak
- Fallback timeout: kalau onDone callback tidak fire (bug Android), auto-advance setelah estimasi waktu
- Per halaman: rekaman audio sendiri (hanya book 6 & 10 yang ada)
- TTS fallback kalau audio tidak ada

### Coin/Reward System
- Dapat coin dari membaca buku: ceil(pages/5) per buku selesai
- Star: 1-4 per halaman berdasarkan % kata yang berhasil dibaca (>75%=4, >50%=3, >25%=2, >0%=1)
- Kata yang di-skip tidak dihitung sebagai berhasil
- Halaman via "Bacakan" dapat full credit (semua kata dianggap dibaca)
- Leaderboard antar anak (post-MVP)
- Orang tua bisa deduct coin saat kasih hadiah fisik
- Ada minimum coin sebelum bisa redeem
- Histori transaksi tersimpan di SQLite, flag `synced` untuk offline-first

### UI/Theme
- Tema warna: ungu-biru cerah, kid-friendly (ala Riri/Educa Studio)
- Primary: `#6C5CE7` (ungu), accent: `#FDCB6E` (kuning), secondary: `#00B894` (teal)
- Background: light purple tint `#F8F7FF`
- Centralized di `src/theme.ts`
- Navigation buttons: 2 baris (action row + page nav row) agar tidak tumpuk di HP kecil
- Cards: rounded 16px, purple shadow
- Tablet vs HP responsive (column count, padding, font size)

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
- build-release.sh: prebuild → gradle → git tag → gh release (--draft=false)

## Mini Games (Planned)

Mini games untuk reinforcement setelah/di sela membaca. Menggunakan kata-kata dari buku yang sedang dibaca.

### 1. Crossword Mini
- Grid crossword kecil (5x5 atau 7x7) dari kata-kata di halaman/buku
- Clue: definisi sederhana atau gambar
- Anak ketik/pilih huruf untuk mengisi
- Reward: coin bonus kalau selesai

### 2. Tebak Kata (Word Guess)
- Mirip Wordle tapi untuk anak-anak
- Kata target diambil dari buku yang baru dibaca
- Hint: huruf pertama, jumlah huruf, atau definisi
- Max 5 tebakan
- Visual feedback: huruf benar (hijau), posisi salah (kuning), salah (abu)

### 3. Susun Kata (Word Scramble)
- Huruf-huruf diacak, anak susun jadi kata yang benar
- Kata dari buku yang sedang dibaca
- Drag-and-drop huruf ke posisi yang benar
- Timer opsional untuk tantangan

### 4. Pasangkan Kata (Word Match)
- 2 kolom: kata di kiri, gambar/definisi di kanan
- Anak mencocokkan dengan garis/drag
- Kata-kata dari buku yang baru dibaca
- Semakin cepat & akurat = lebih banyak bintang

### 5. Isi Kata Rumpang (Fill in the Blank)
- Kalimat dari buku dengan 1-2 kata dihilangkan
- Pilihan kata (multiple choice) atau ketik sendiri
- Melatih pemahaman konteks bacaan

### 6. Tebak Gambar (Picture Quiz)
- Tampilkan gambar, anak pilih/tulis kata yang sesuai
- Vocabulary building dari kata-kata di buku
- Bisa pakai cover buku atau gambar terkait cerita

### Mini Games — Design Principles
- Selalu menggunakan kata/kalimat dari buku yang sedang/baru dibaca
- Difficulty scales dengan umur dan kemampuan anak
- Reward: coin + bintang bonus
- Tidak wajib — opsional setelah selesai halaman/buku
- Fun, colorful, animasi sederhana
- Bisa muncul sebagai "challenge" di antara halaman (setiap 3-5 halaman)

## Current Implementation Status

### Done (v1.0.6)

**Core Reading (v0.1.0-alpha.5)**
- [x] Project setup (Expo 55, TypeScript, expo-router)
- [x] Pilih profil anak (YouTube Kids style, SQLite)
- [x] Tambah anak baru (nama + umur)
- [x] Perpustakaan buku - 20 buku dengan cover images
- [x] Baca buku - paragraf grouped, navigasi halaman
- [x] Klik kata → TTS per kata (expo-speech, id-ID)
- [x] Read-to-me mode (word-by-word TTS + highlight biru) + timeout fallback
- [x] Guided reading: sequential word-by-word, max 4 attempts, auto-skip
- [x] Word status: target (kuning), success (hijau), skipped (kuning pucat), readToMe (biru)
- [x] Page completion gate: "Lanjut" disabled sampai halaman dibaca
- [x] Speech recognition hook (expo-speech-recognition, sequential matching)
- [x] Star scoring per halaman (based on successful reads only)
- [x] Coin reward saat selesai buku
- [x] Reading progress tracking (SQLite)
- [x] Reward history (SQLite, synced flag)
- [x] Celebration screen (Alhamdulillah + coin/star animation)
- [x] Auto-update dari GitHub releases (semver + alpha/beta/rc)
- [x] Responsive tablet/HP layout (2-row navigation)
- [x] Font auto-adjust berdasarkan umur
- [x] Kid-friendly purple theme (src/theme.ts)
- [x] Build script (build-release.sh) → APK naming hayya-baca-vX.Y.Z.apk
- [x] Artikel mode: scroll continuous, TTS per paragraf, kuis di akhir (10 sampel)
- [x] Quiz screen: pilihan ganda + benar/salah, feedback + explanation, reward calculation
- [x] Home tabs: Buku / Artikel
- [x] Book/article progress badges + progress bar di home screen
- [x] Leaderboard antar anak (coin/bintang sort)
- [x] Article reading progress tracking (via quiz completion)

**Backend & Sync (v0.1.0-alpha.6 → v1.0.0)**
- [x] Django 6.0 + DRF project (`backend/`)
- [x] Models: Book, Article, Quiz, Child, ChildAccess, ShareInvite, ReadingProgress, QuizAttempt, RewardHistory
- [x] Import commands: `import_books` (20 buku), `import_articles` (10 artikel), `import_markdown_articles`
- [x] Cover generation dari title (Pillow, 1080x720)
- [x] Static JSON publisher + manifest.json versioning
- [x] REST API endpoints: auth, children CRUD, share invite, progress, quiz, rewards
- [x] Permission matrix: parent (full), teacher (read-only), public (books only)
- [x] OpenAPI schema + Swagger UI (`/api/docs/`)
- [x] API contract documentation (`backend/API.md`)
- [x] Backend sync — API client di app (auth token, progress/reward sync)
- [x] Parent dashboard (PIN gate, login/logout, manual sync, children progress)
- [x] Fetch articles from server with bundled fallback + SQLite cache
- [x] PostgreSQL production, auto-deploy CI/CD
- [x] Multi-device sync (push-first, active child only, idempotency)

**GameZone (v1.0.0+)**
- [x] Game model, API, admin preview
- [x] Game screen (HTML5 WebView, coin-per-session)
- [x] Reading timeline + coin audit trail
- [x] Sample games: Dino Jump, Memory Card, Pecah Balon, Tangkap Bintang

**Quality (v1.0.1 → v1.0.6)**
- [x] E2e tests (real component + user action tests)
- [x] Replace React Query with event emitter for children data
- [x] Bug fixes: reading, quiz, game, article screens, keyboard overlap, safe area

### TODO — Medium Priority
- [ ] Audio playback dari file rekaman (book 6 & 10)
- [ ] Reading time estimate di header artikel
- [ ] Content download dari server — fetch manifest, download buku/artikel baru

### TODO — Low Priority (Post-MVP)
- [ ] Custom font untuk anak belajar baca
- [ ] Ideas/insight tracking (orang tua)
- [ ] Onboarding flow

### Parking (lihat [docs/parking/](../docs/parking/))
- [ ] Per-child game score history & per-game leaderboard
- [ ] Voice training — simpan suara anak untuk custom TTS/ASR

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
│   ├── home.tsx            # Grid perpustakaan buku + artikel (tabs)
│   ├── celebrate.tsx       # Selebrasi selesai buku/artikel
│   ├── leaderboard.tsx     # Peringkat antar anak (coin/bintang)
│   ├── read/
│   │   └── [bookId].tsx    # Baca buku (guided reading, TTS, highlight)
│   ├── article/
│   │   └── [articleId].tsx # Baca artikel (scroll, TTS per paragraf)
│   └── quiz/
│       └── [articleId].tsx # Kuis artikel (MC + true/false)
├── src/
│   ├── components/
│   │   └── UpdateBar.tsx   # Auto-update UI
│   ├── context/
│   │   └── UpdateContext.tsx
│   ├── hooks/
│   │   ├── useChildren.ts  # TanStack Query children CRUD
│   │   ├── useSpeechRecognition.ts  # Guided sequential speech recognition
│   │   └── useUpdateCheck.ts        # GitHub releases auto-update
│   ├── lib/
│   │   ├── articles.ts     # Load artikel + quiz dari static JSON
│   │   ├── books.ts        # Load buku dari static JSON, group paragraf
│   │   ├── children.ts     # SQLite children operations
│   │   ├── database.ts     # SQLite schema (children, reading_progress, reward_history)
│   │   ├── rewards.ts      # Coin/star rewards + reading progress
│   │   ├── session.ts      # In-memory selected child
│   │   └── speech.ts       # TTS, word matching, scoring
│   ├── theme.ts            # Centralized color theme
│   └── types/
│       ├── index.ts        # Core types
│       └── update.ts       # Update types
├── content/articles/       # 10 artikel + quiz (JSON)
├── content/books/          # 20 buku (raw.json + cover + audio)
├── backend/                # Django backend (CMS + API)
│   ├── config/             # Django settings
│   ├── accounts/           # Child, ChildAccess, ShareInvite
│   ├── library/            # Book, BookPage, ArticleSection, Quiz
│   ├── reading/            # ReadingProgress, QuizAttempt
│   ├── rewards/            # RewardHistory
│   └── media/published/    # Static JSON output
├── docs/
│   ├── memory.md           # This file
│   └── parking/            # Parked feature ideas
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
- Python 3.14, Django 6.0, Django REST Framework
- SQLite (dev) → PostgreSQL (prod)
- Pillow (cover generation)
- uv (package manager)

### Repo & Structure
- Satu repo: `ksatriamuslim-android/backend/`
- Detail: [backend/README.md](../backend/README.md)

### Apps
| App | Fungsi |
|-----|--------|
| `library` | Buku, artikel, sections, quiz, cover generation, publish static JSON |
| `accounts` | Child profiles, parent/teacher access (max 2 parent), share invite |
| `reading` | Reading progress, quiz attempts |
| `rewards` | Coin/star reward history |

### Architecture: Static Content Publisher
- Django DB = CMS untuk edit konten
- Output: static JSON files (`media/published/`) — no DB hit untuk konten
- `manifest.json` sebagai index + versioning
- App fetch manifest → download individual JSON yang baru/updated
- Management commands: `import_books`, `import_articles`, `generate_covers`, `publish`

### Dua Tipe Konten
1. **Buku** (anak ≤6): `pages[]`, speech recognition per kata, stars per halaman
2. **Artikel** (anak >6): `sections[]` (paragraph/heading/arabic/list), scroll continuous, quiz di akhir, completed = sudah attempt quiz (no gating)

### User Model
- **Parent**: Django User + simple login (username + password), max 2 per anak
- **Teacher**: read-only progress, di-share via invite code (6 digit, expire 24h)
- **Child**: profil anak, M2M ke user via `ChildAccess(role=parent|teacher)`

### Client Apps (planned)
1. **App Anak** (Hayya Baca) - React Native, sudah ada
2. **App Orang Tua** - mobile, manage anak, lihat progress, timeline
3. **Backend** - Django, serve kedua app

### Data & ML (long-term)
- Collect: interaction data, teks, audio dari anak-anak
- Purpose: belajar ML/DL, NLP, data cleaning
- Pipeline: django.tasks → export → Jupyter/pandas
- Training: di laptop atau server terpisah
