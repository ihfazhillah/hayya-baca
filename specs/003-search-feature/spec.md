# Feature Specification: Unified Search (Buku & Artikel)

**Feature Branch**: `003-search-feature`
**Created**: 2026-04-12
**Status**: Draft
**Input**: Anak butuh cara cepat menemukan kembali artikel/buku yang pernah dibaca atau yang judulnya mereka ingat. Ranking dinamis menenggelamkan konten lama; bookmark hanya membantu untuk yang sudah ditandai eksplisit.

## Problem Statement

Hayya Baca mendorong eksplorasi dengan ranking dinamis — setelah dibaca, artikel turun di daftar. Kombinasi ini bagus untuk discovery, tapi membuat anak kesulitan menemukan lagi artikel lama yang mereka minati tapi tidak sempat di-bookmark. Saat ini tidak ada entry point pencarian sama sekali — anak hanya bisa scroll library.

### Dampak
- Anak menyerah mencari artikel yang pernah mereka lihat.
- Konten lama efektif hilang dari jangkauan anak.
- Bookmark tidak cukup: anak belum tentu mem-bookmark saat baca pertama kali.

## Goals

1. Anak bisa mencari buku & artikel dalam satu UI unified.
2. Hasil search menandai tipe konten (buku vs artikel) secara visual.
3. Autocomplete/saran muncul sejak anak mengetik, menggabungkan frasa dari judul konten + query populer anak-anak lain.
4. Urutan hasil: paling relevan dulu, dengan sedikit boost untuk konten yang pernah dibaca child aktif.
5. 100% API-driven — tidak ada cache lokal untuk hasil search maupun suggestion.

## Non-Goals

- Tidak ada offline search (harus online — pure API).
- Tidak search di dalam body text buku (`BookPage`) / `ArticleSection` — **scope hanya title + categories**.
- Tidak search Arabic reference pada iterasi ini.
- Tidak ada voice search.
- Tidak ada filter lanjutan (umur, kategori dropdown, dsb) — hanya query bebas.
- Tidak ada search di GameZone.
- Tidak ada personalisasi berbasis ML; ranking deterministik.

## User Stories

### US-1: Membuka search dari home
Sebagai anak yang ingin mencari bacaan, saya ingin menekan icon search di header library agar langsung masuk ke halaman search khusus.

**Acceptance:**
- Icon search (kaca pembesar) muncul di header `app/home.tsx`, terlihat di semua tab (buku/artikel/permainan).
- Tap → `router.push('/search')` ke screen khusus dengan input field ter-fokus otomatis.

### US-2: Mengetik dan melihat autocomplete
Sebagai anak yang sedang mengetik, saya ingin melihat saran query muncul secara live agar saya tidak perlu mengetik lengkap.

**Acceptance:**
- Saat input berubah (debounce ~250ms), app memanggil `GET /api/search/suggest/?q=…` dan menampilkan hingga 8 saran.
- Saran berisi campuran: (a) n-gram frasa dari judul konten yang match, (b) query populer dari SearchLog yang match prefix.
- Tap saran → isi input dengan saran tersebut dan jalankan search.
- Jika input kosong → tampilkan top N query populer global (fallback) sebagai "Pencarian populer".

### US-3: Melihat hasil search unified
Sebagai anak yang sudah submit query, saya ingin melihat hasil buku dan artikel dalam satu daftar dengan tanda tipe yang jelas.

**Acceptance:**
- Hasil datang dari `GET /api/search/?q=…&child_slug=…` (single endpoint, mixed results).
- Setiap item menampilkan badge tipe (`BUKU` / `ARTIKEL`) — pola visual mengikuti `FavoritSection` di `app/home.tsx`.
- Item yang pernah dibaca child aktif mendapat badge tambahan (misal ✓ "Pernah dibaca") dan sedikit boost di ranking.
- Tap item → buka reading/article screen yang sesuai (`/read/[bookId]` atau `/article/[articleId]`).
- Empty state ramah anak bila 0 hasil ("Tidak ditemukan. Coba kata lain ya!").

### US-4: Urutan berdasarkan relevansi
Sebagai anak, saya ingin hasil paling cocok muncul di atas agar cepat ketemu.

**Acceptance:**
- Score deterministik (lihat FR-4).
- Urutan: `title exact match` > `title prefix` > `title contains` > `category match`, dengan boost kecil untuk konten yang ada di `reading_progress`/`reading_log` child aktif.
- Tie-breaker: `updated_at DESC`.

### US-5: Search activity membantu anak lain
Sebagai platform, saya ingin mencatat query yang benar-benar menghasilkan klik agar suggestion makin relevan.

**Acceptance:**
- Saat anak tap salah satu hasil search, app POST ke `/api/search/log/` dengan `{child_slug, query, result_slug, result_type}`.
- Tidak ada log untuk query tanpa klik (anti-noise dari typo).
- Data di-agregasi oleh `generate_search_suggestions` management command untuk hybrid suggestion.

## Functional Requirements

### FR-1: Backend — Data Model (app `search`)
Buat app Django baru `search/`. Model Book/Article tetap di app `library` existing.

Model baru:
- `SearchSuggestion`
  - `phrase` (CharField, indexed, unique)
  - `source` (CharField: `ngram_title` | `user_query`)
  - `weight` (FloatField) — tf-idf score untuk ngram, atau frequency count untuk user_query
  - `updated_at`
- `SearchLog`
  - `child` (FK → Child, `on_delete=CASCADE`)
  - `query` (CharField, max 255, indexed)
  - `result_slug` (CharField) — slug konten yang di-tap
  - `result_type` (CharField: `book` | `article`)
  - `created_at`
  - Constraint: simpan **hanya** saat ada klik (lihat FR-5).

### FR-2: Backend — Endpoints
Tambah di `backend/search/urls.py`, mount di `backend/config/urls.py` sebagai `/api/search/`.

- `GET /api/search/?q=<str>&child_slug=<opt>` — unified search. Auth: `IsAuthenticated`.
  - Response: `{ results: [{ slug, type: 'book'|'article', title, categories, cover_url?, already_read: bool, score }], total: int }`.
  - Pagination tidak diperlukan untuk iterasi awal (cap 30 hasil).
- `GET /api/search/suggest/?q=<str>` — autocomplete. Auth: `IsAuthenticated`.
  - Response: `{ suggestions: [{ phrase, source }] }` (max 8).
  - Jika `q` kosong → return top 5 `user_query` populer global.
- `POST /api/search/log/` — log klik hasil. Auth: `IsAuthenticated`.
  - Body: `{ child_slug, query, result_slug, result_type }`.
  - Idempotent: insert baris baru tiap klik (bukan upsert) — frekuensi dihitung via aggregation.

### FR-3: Backend — Management Command
`backend/search/management/commands/generate_search_suggestions.py`

Langkah:
1. Kumpulkan semua `Book.title` (is_published=True) — baik `content_type=book` maupun `article`.
2. Tokenisasi + generate n-gram 1–4 (case-insensitive, strip diakritik/tanda baca).
3. Hitung tf-idf per n-gram (dokumen = title individu).
4. Simpan top-K (mis. 500) ke `SearchSuggestion` dengan `source='ngram_title'`, replace existing ngram rows.
5. Aggregate `SearchLog` → top query (>= 2 occurrences dalam 30 hari terakhir), simpan dengan `source='user_query'`, `weight=count`.
6. Idempotent — bisa dipanggil berulang. Dipanggil manual post-publish konten baru.

TF-IDF bisa pakai `sklearn.feature_extraction.text.TfidfVectorizer` (tambah dep kalau belum ada) **atau** implementasi manual pure-Python — pilihan diputuskan di plan.md berikutnya.

### FR-4: Backend — Ranking Formula
Di view `/api/search/`, untuk setiap Book yang match (`title__icontains` OR `categories` contains token):

```
score = 0
if title.lower() == q.lower(): score += 100
elif title.lower().startswith(q.lower()): score += 50
elif q.lower() in title.lower(): score += 25
if any(q.lower() in c.lower() for c in categories): score += 10
if already_read_by_child: score += 5
```

Sort by `(score DESC, updated_at DESC)`. Filter score > 0. Cap 30.

`already_read` ditentukan via join ke `reading_progress` (untuk book) atau `reading_log` (untuk article) pada `child` yang dikirim. Jika `child_slug` kosong → `already_read=false` untuk semua.

Catatan dev/prod: SQLite `icontains` cukup untuk dataset sekarang (< 100 konten). Tidak perlu Postgres SearchVector.

### FR-5: Mobile — API Client
Tambah di `src/lib/api.ts`:
- `searchContent(query: string, childSlug?: string): Promise<SearchResult[]>`
- `searchSuggest(query: string): Promise<Suggestion[]>`
- `logSearchClick(childSlug: string, query: string, resultSlug: string, resultType: 'book'|'article'): Promise<void>`

Semua via `apiFetch` existing (auth token otomatis). **Tidak** cache hasil.

### FR-6: Mobile — Types & Helpers
- Tipe baru di `src/types/` atau inline di `api.ts`:
  - `SearchResult = { slug, type, title, categories, coverUrl?, alreadyRead, score }`
  - `Suggestion = { phrase, source }`
- Tidak ada helper DB — pure API. Tidak ada table `search_*` di SQLite.

### FR-7: Mobile — UI: Search Icon Entry
- Tambah `IconButton` (kaca pembesar) di header `app/home.tsx`, konsisten dengan styling existing.
- Tap → `router.push('/search')`.
- Visible di semua tab (buku/artikel/permainan).

### FR-8: Mobile — UI: Search Screen
Screen baru `app/search.tsx`:
- Header: tombol back + input field (`TextInput`) fokus otomatis, placeholder "Cari buku atau artikel…".
- Saat input berubah (debounce 250ms):
  - Jika `q.length < 2`: tampilkan "Pencarian populer" dari `searchSuggest('')`.
  - Jika `q.length >= 2`: tampilkan `searchSuggest(q)` + kick off `searchContent(q)` paralel.
- Layout dua section:
  1. **Saran** (chip list) — tap suggestion → set input + jalankan search.
  2. **Hasil** — list vertikal. Tiap item re-use komponen baru `SearchResultItem` yang mirip `FavoritSection` item (cover/initials + title + badge tipe + badge "Pernah dibaca" jika `alreadyRead`).
- Empty states:
  - Sebelum mengetik: tampilkan "Pencarian populer" + tip singkat.
  - 0 hasil: ilustrasi + "Tidak ditemukan. Coba kata lain ya!".
- Loading: indikator kecil di atas list.
- Tap hasil: (a) call `logSearchClick`, fire-and-forget; (b) navigate ke `/read/[bookId]` atau `/article/[articleId]`.

### FR-9: Mobile — Test
Tambah `src/__tests__/usecase-search.test.tsx`:
- Mengetik query → memanggil API search + suggest.
- Tap hasil → navigate ke screen yang tepat + memicu `logSearchClick`.
- Empty query → tampilkan "Pencarian populer".
- 0 hasil → empty state muncul.
- Mock `src/lib/api.ts` functions, re-use pattern dari test bookmark.

## Tracer Bullet Scope

Tracer bullet end-to-end minimal:
1. **Backend**: app `search`, 2 model, 3 endpoint (`search`, `suggest`, `log`), 1 management command, unit test tipis untuk ranking.
2. **Mobile**: `api.ts` functions, `app/search.tsx` screen, icon entry di `home.tsx`, 1 use-case test.
3. **Seed**: jalankan `generate_search_suggestions` sekali di dev DB supaya suggestion tidak kosong saat demo.

Yang **TIDAK** masuk tracer bullet awal:
- Full-text search di body konten.
- Voice search.
- History search per child ("pencarian terakhirmu").
- Highlight match di hasil.
- Infinite scroll / pagination.
- Animasi transisi saat membuka search.

## Resolved Decisions

- **Scope search**: title + categories (tidak body).
- **Suggestion storage**: hybrid — precomputed n-gram dari title + popularity dari SearchLog klik.
- **Reading history**: boost ranking kecil + badge "Pernah dibaca"; tidak ada tab terpisah.
- **SearchLog**: per-child, hanya saat anak klik hasil (bukan saat tiap submit) — untuk mengurangi noise typo.
- **Entry point**: icon search di header `app/home.tsx`, masuk ke screen khusus `app/search.tsx`.
- **Ranking**: deterministik dengan score bertingkat (title exact > prefix > contains > category), + small boost untuk already-read.
- **Caching**: tidak ada, pure API.
- **DB**: `icontains` cukup untuk dev SQLite dan prod Postgres; tidak menambah `django.contrib.postgres`.

## Success Criteria

- Anak bisa mengetik judul artikel lama yang pernah dibaca dan menemukannya di 5 hasil teratas.
- Autocomplete menampilkan minimal 3 saran untuk query 2+ huruf yang match konten existing.
- Hasil mencampur buku + artikel dalam satu list dengan badge tipe jelas.
- Item yang pernah dibaca child aktif menampilkan badge "Pernah dibaca" dan naik rank kecil dibanding item identik yang belum dibaca.
- Tidak ada regresi di flow library/bookmark/sync existing.
- Saat offline: search screen menampilkan error ramah anak ("Perlu internet untuk cari") — tidak crash, tidak cache.
- Setelah klik hasil: entri SearchLog muncul di backend untuk child tersebut.
- `generate_search_suggestions` idempotent; dijalankan 2× berturut-turut menghasilkan state DB sama.
