# Hayya Baca — Django Backend

Backend untuk aplikasi Hayya Baca. Berfungsi sebagai CMS untuk mengelola konten buku & artikel, dan (fase 2) sebagai API server untuk sync data user.

## Stack

- Python 3.14, Django 6.0, Django REST Framework
- SQLite (dev) → PostgreSQL (prod)
- Pillow (cover image generation)
- uv (package manager)

## Setup

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py createsuperuser
```

## Apps

| App | Fungsi |
|-----|--------|
| `library` | Buku, artikel, sections, quiz, cover generation, publish |
| `accounts` | Child profiles, parent/teacher access, share invite |
| `reading` | Reading progress, quiz attempts |
| `rewards` | Coin/star reward history |

## Management Commands

### Import data

```bash
# Import 20 buku dari content/books/*/raw.json
uv run python manage.py import_books

# Import artikel dari folder JSON
uv run python manage.py import_articles /path/to/articles/

# Import single artikel
uv run python manage.py import_articles /path/to/article.json
```

### Generate covers

```bash
# Generate cover untuk yang belum punya
uv run python manage.py generate_covers

# Regenerate semua
uv run python manage.py generate_covers --force
```

Cover: 1080x720 PNG, warna dari palette berdasarkan hash title, inisial besar + judul di band bawah.

### Publish (static JSON)

```bash
# Publish semua yang belum/berubah
uv run python manage.py publish --all

# Publish specific IDs
uv run python manage.py publish --ids 1 3 5

# Force re-publish semua
uv run python manage.py publish --all --force
```

Output di `media/published/`:
```
media/published/
  books/1.json        # format sama dengan content/books/*/raw.json
  articles/25.json    # format artikel dengan sections + quiz
  manifest.json       # index semua konten + versioning
```

App fetch `manifest.json` → bandingkan version → download individual JSON yang baru.

## Content Types

### Buku (anak ≤6 tahun)
- `pages[]` — teks per halaman
- Reading: per-kata + speech recognition
- Reward: coins = ceil(pages/5), stars = 1-4 per halaman

### Artikel (anak >6 tahun)
- `sections[]` — paragraph, heading, arabic, list
- Reading: scroll continuous + optional TTS
- Quiz di akhir (multiple choice, true/false)
- Completed = sudah attempt quiz (apapun skornya)
- Reward: coins fixed per artikel, stars dari quiz score

## User Model (fase 2)

- **Parent**: Django User, max 2 per anak
- **Teacher**: bisa lihat progress anak, di-share via invite code
- **Child**: profil anak, M2M ke user via `ChildAccess(role=parent|teacher)`

## Admin

```bash
uv run python manage.py runserver
# → http://localhost:8000/admin/
```

- Edit buku/artikel + inline pages/sections/quiz
- Publish action langsung dari admin
