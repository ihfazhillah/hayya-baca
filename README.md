# Hayya Baca

Aplikasi belajar membaca bahasa Indonesia untuk anak-anak Muslim.

**Hayya Baca** ("Ayo Baca") membantu anak belajar membaca melalui kisah-kisah sahabat Nabi dan artikel islami, dengan speech recognition, text-to-speech, kuis, dan sistem reward.

## Fitur

- **Buku** (anak ≤6 tahun) — baca per kata dengan speech recognition, bintang per halaman
- **Artikel** (anak >6 tahun) — baca mandiri + kuis di akhir
- **GameZone** — mini games HTML5, bayar koin per sesi waktu
- **Reward** — koin & bintang dari membaca, leaderboard antar anak
- **Offline-first** — semua data lokal, sync ke server kalau ada koneksi

## Struktur

```
app/          React Native (Expo) — app anak
backend/      Django — CMS, API, GameZone
content/      Buku & artikel (static JSON)
docs/         Dokumentasi lengkap
```

## Quick Start

**App (React Native)**
```bash
npm install
npx expo start
```

**Backend (Django)**
```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py import_books
uv run python manage.py import_articles ../content/articles/
uv run python manage.py generate_covers
uv run python manage.py publish --all --force
uv run python manage.py runserver
```

## Docs

- [Project Memory](docs/memory.md) — arsitektur, keputusan, status lengkap
- [Changelog](CHANGELOG.md) — riwayat perubahan per versi
- [Backend README](backend/README.md) — setup, commands, content types
- [API Contract](backend/API.md) — endpoint reference
- [Game Ideas](backend/GAMES.md) — 55 ide mini games
- [Parking Ideas](docs/parking/) — ide fitur yang sedang ditimbang

## Tech Stack

| Layer | Stack |
|-------|-------|
| App | Expo 55, React Native 0.83, TypeScript |
| Backend | Django 6.0, DRF, Pillow |
| Speech | expo-speech-recognition, @mhpdev/react-native-speech |
| Data | SQLite (app), SQLite/PostgreSQL (backend) |
| Games | HTML5 Canvas/JS via WebView |
