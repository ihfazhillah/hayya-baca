# Query riwayat bacaan anak langsung ke DB produksi

Kadang butuh inspeksi data bacaan di luar apa yang ditampilkan parent page (misal: topik apa yang dibaca, rentang > 2 pekan, agregasi per anak). Cara paling cepat: Django shell di server dengan settings production.

## Akses server

- Host SSH: `ksatriamuslim`
- Backend path: `~/hayyabaca/backend`
- Credentials (DB, SECRET_KEY, dll.) sudah tersimpan di `backend/.env` di server — **jangan** taruh di dokumen ini. Cukup `source` file tersebut sebelum menjalankan shell.

## Menjalankan shell dengan settings production

Settings terbagi `config.settings.{base,dev,production}`. Default `manage.py` menunjuk ke dev (SQLite lokal `db.sqlite3`) — tabel sinkron hanya ada di Postgres produksi, jadi **harus** override ke production settings, dan load `.env` supaya `DJANGO_SECRET_KEY` + koneksi DB terisi.

```bash
ssh ksatriamuslim
cd ~/hayyabaca/backend
set -a && . ./.env && set +a
DJANGO_SETTINGS_MODULE=config.settings.production .venv/bin/python manage.py shell < /tmp/query.py
```

Tanpa `set -a; . ./.env; set +a` → `KeyError: 'DJANGO_SECRET_KEY'`.
Tanpa `DJANGO_SETTINGS_MODULE=...production` → query balik `no such table: reading_readinglog` (nyasar ke sqlite dev).

## Model yang relevan

- `reading.ReadingLog` — append-only, satu baris per penyelesaian buku/artikel. Field: `child_id`, `book_id` (slug string: `"1"`, `"article-112"`, `"__unlock:1"`), `completed_at`, `source_device`, `idempotency_key`. Ini sumber kebenaran untuk riwayat.
- `reading.ReadingProgress` — snapshot per (child, book). Ada `updated_at` dan `completed_at` tapi bukan riwayat lengkap (ter-overwrite).
- `library.Book` — `slug`, `title`, `content_type` (`book`/`article`), `categories` (JSONField = `list[str]`).
- `accounts.Child` — untuk map `child_id` → nama.

## Catatan soal `Book.categories`

- Field adalah `JSONField(default=list)`, benar-benar list Python (bukan string). Kalau via SQL mentah di Postgres memang terlihat seperti JSON text, tapi via ORM sudah ter-deserialize.
- **Artikel** terisi (contoh: `['Kisah Nyata', 'Teladan Muslimah']`).
- **Buku anak** (`content_type=book`) saat ini masih `[]`. Agregasi topik per anak akan bias ke artikel saja sampai field ini diisi untuk buku.

## Management command: `reading_report`

Cara cepat tanpa menulis script ad-hoc. Lokasi: `backend/reading/management/commands/reading_report.py`.

```bash
# di server, dari ~/hayyabaca/backend, setelah source .env + set DJANGO_SETTINGS_MODULE=config.settings.production
.venv/bin/python manage.py reading_report --days 14
.venv/bin/python manage.py reading_report --days 30 --child Sakinah
.venv/bin/python manage.py reading_report --days 30 --overview-only
.venv/bin/python manage.py reading_report --days 7  --detail-only
```

Output:
- **Detail per tanggal** — dikelompokkan per anak, jam lokal, tipe (book/article), judul, kategori.
- **Overview per anak** — jumlah buku, artikel, unik judul, distribusi kategori (sorted desc).
- **Global overview** — total buku + artikel + top 10 kategori (hanya kalau >1 anak di hasil).

Marker `__unlock:*` di-skip otomatis.

**Penting:** command ini agnostik ke settings — kalau dijalankan lokal dengan default settings, dia akan kena SQLite dev yang tidak punya tabel sinkron. **Harus** dijalankan di server produksi dengan `DJANGO_SETTINGS_MODULE=config.settings.production` dan `.env` ter-load (lihat bagian "Menjalankan shell dengan settings production" di atas untuk incantation lengkap).

## Template query ad-hoc: riwayat N hari terakhir

Tulis ke file di server (mis. `/tmp/reading_query.py`) lalu pipe ke `manage.py shell`. Pisahkan file supaya aman dari escaping quote di one-liner SSH.

```python
from datetime import timedelta
from django.utils import timezone
from reading.models import ReadingLog
from library.models import Book
from accounts.models import Child

DAYS = 30  # ganti sesuai kebutuhan
since = timezone.now() - timedelta(days=DAYS)

logs = list(
    ReadingLog.objects.filter(completed_at__gte=since)
    .order_by("child_id", "-completed_at")
)
print(f"Total logs in last {DAYS} days: {len(logs)}\n")

children = {c.id: c.name for c in Child.objects.all()}
slugs = {l.book_id for l in logs if not l.book_id.startswith("__")}
books = {b.slug: b for b in Book.objects.filter(slug__in=slugs)}

for l in logs:
    b = books.get(l.book_id)
    title = b.title if b else l.book_id
    cats = b.categories if b else []
    ctype = b.content_type if b else "-"
    name = children.get(l.child_id, l.child_id)
    ts = l.completed_at.strftime("%Y-%m-%d %H:%M")
    print(f"{name} | {ts} | [{ctype}] {title} | {cats}")
```

Untuk agregasi topik per anak, kumpulkan `cats` ke `collections.Counter` per `name`.

## Entri `book_id` khusus yang perlu di-skip

- Prefix `__unlock:` → marker unlock konten, bukan bacaan aktual. Filter `if not l.book_id.startswith("__")` sebelum join ke `Book`.

## Alternatif: `psql` langsung

Kalau cuma butuh count / cek cepat bisa `psql` langsung ke DB produksi pakai kredensial di `.env`. Tapi untuk apa pun yang butuh map slug → title / categories, ORM jauh lebih enak karena slug-nya string bebas.
