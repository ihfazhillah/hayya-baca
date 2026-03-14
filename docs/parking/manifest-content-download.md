# Manifest-Driven Content Download

## Goal
Server sebagai single source of truth untuk konten buku & artikel.
App tetap bundled beberapa buku untuk first-install offline, lalu sync dari server kalau ada internet.

## Constraints
1. **Scoring aman**: update konten TIDAK boleh merusak reading progress & reward yang sudah ada
2. **Offline-first**: install tanpa internet → tetap bisa baca bundled books
3. **Incremental update**: hanya download yang berubah (quiz ditambah, typo difix, buku baru)
4. **Content bisa berkurang**: buku dihapus dari server → app hapus juga, tapi progress tetap

## Current State
- Buku: 20 buku hardcoded di `books.ts` (bundled JSON)
- Artikel: fetch dari API kalau online, fallback ke 10 bundled + SQLite cache
- Manifest: sudah ada `publish` management command yang generate `manifest.json`
- Progress key: slug (buku = "1", artikel = "article-112")

## Architecture

### Manifest Format (server)
```json
{
  "version": 42,
  "updated_at": "2026-03-14T12:00:00Z",
  "items": [
    {
      "slug": "1",
      "type": "book",
      "title": "Sahabat yang disebut namanya di langit",
      "version": 3,
      "min_age": 5,
      "categories": ["Kisah Sahabat"],
      "content_hash": "sha256:abc123...",
      "cover_url": "/media/published/covers/1.jpg"
    },
    {
      "slug": "article-112",
      "type": "article",
      "title": "Lelaki Anshar dengan Tiga Anak Panah",
      "version": 2,
      "min_age": 8,
      "categories": ["Kisah Sahabat"],
      "content_hash": "sha256:def456...",
      "quiz_version": 1
    }
  ]
}
```

Key design:
- `slug` = progress key = immutable identity. **Tidak boleh berubah setelah publish.**
- `version` naik setiap perubahan konten (text fix, quiz tambah, dll)
- `quiz_version` terpisah supaya bisa tau kalau hanya quiz yang berubah
- `content_hash` untuk integrity check setelah download

### Content JSON Format (per item)
```json
{
  "slug": "1",
  "type": "book",
  "version": 3,
  "title": "...",
  "pages": [...],
  "reference_text_ar": "...",
  "cover": "..."
}
```
Artikel:
```json
{
  "slug": "article-112",
  "type": "article",
  "version": 2,
  "title": "...",
  "content": "...",
  "source": "...",
  "quiz": [...]
}
```

### App Flow

```
App Open
  │
  ├── Load bundled content (always available)
  ├── Load downloaded content dari local storage (override bundled)
  ├── User bisa langsung baca ───────────────────────────────────────►
  │
  ├── Background: fetch manifest dari server
  │   ├── Compare per-item version vs local
  │   ├── New items → queue download
  │   ├── Updated items → queue download
  │   ├── Removed items → mark for removal
  │   └── Unchanged → skip
  │
  ├── Download queue (background, non-blocking)
  │   ├── GET /media/published/{type}/{slug}.json
  │   ├── Verify content_hash
  │   ├── Save to DocumentDirectory/{type}/{slug}.json
  │   └── Update local manifest in SQLite
  │
  └── Notify UI: "X buku baru tersedia" (optional refresh)
```

### Content Resolution Order
```
getBookContent(slug):
  1. Downloaded content (DocumentDirectory) ← paling baru
  2. Bundled content (hardcoded import)     ← fallback offline
  3. null                                    ← belum pernah download
```

### Scoring Safety

**Prinsip: slug = progress key. Slug immutable.**

| Skenario | Apa yang terjadi | Progress aman? |
|----------|-----------------|----------------|
| Text fix (typo) | version naik, download ulang content | ✅ slug sama |
| Quiz ditambah/diubah | quiz_version naik, download ulang | ✅ slug sama, star/coin tetap |
| Buku baru | item baru di manifest, download | ✅ belum ada progress |
| Buku dihapus | item hilang dari manifest | ✅ progress tetap di DB, buku hilang dari library |
| Buku di-unpublish lalu re-publish | slug sama, version naik | ✅ progress tetap |
| Halaman ditambah/dikurangi | version naik | ⚠️ last_page mungkin > total pages. Handle: cap to max |

**Edge case halaman berubah:**
- Buku punya 10 halaman, anak sudah baca sampai halaman 8
- Update: buku jadi 7 halaman (pages di-regroup)
- Progress last_page = 8 > total 7 → cap ke 7, mark completed
- Stars/coins dari halaman lama tetap (sudah earned)

### Removal Handling
- Server manifest tidak include item → app detect sebagai "removed"
- App: hapus downloaded content file, hapus dari library list
- App: **JANGAN hapus reading_progress dan reward_history** (data tetap di DB)
- Admin bisa lihat historical progress dari buku yang sudah dihapus

### SQLite Schema
```sql
CREATE TABLE content_manifest (
  slug TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'book' | 'article'
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  quiz_version INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  local_path TEXT,              -- NULL = belum download
  is_bundled INTEGER NOT NULL DEFAULT 0,
  downloaded_at TEXT,
  removed INTEGER NOT NULL DEFAULT 0  -- soft delete
);
```

### Bundled Content Strategy
- Bundle 5-10 buku populer dalam APK (subset dari 20 buku saat ini)
- Buku bundled: `is_bundled = 1` di manifest table
- Saat server manifest masuk, bundled items tetap ada tapi bisa di-override oleh downloaded version
- Bundled = safety net, bukan source of truth
- Reduce APK size: bundled buku tanpa cover images (download cover nanti)

### Download Strategy
- **Manifest**: fetch on every app open (small JSON, ~10KB)
- **Content**: download semua yang outdated/new saat ada internet
- **Priority**: buku yang sedang/baru dibaca anak ini → download duluan
- **Retry**: gagal download → retry next app open
- **Bandwidth**: artikel text-only (~5-20KB each), buku + pages (~10-50KB each)
- Total 930 artikel ≈ ~10-20MB, 20 buku ≈ ~1MB → manageable

### Server Changes
1. `publish` command: output `manifest.json` + individual `{type}/{slug}.json`
2. `publish` command: include `content_hash`, `quiz_version` in manifest
3. `publish` command: slug immutable enforcement (error if slug changes)
4. Nginx: serve `/media/published/` as static files (no auth)
5. Book model: `published_version` auto-increment on publish

### App Changes
1. `src/lib/content-manager.ts` (NEW): manifest fetch, diff, download queue
2. `src/lib/books.ts`: refactor ke content resolution (downloaded → bundled → null)
3. `src/lib/articles.ts`: same refactor
4. `src/lib/database.ts`: `content_manifest` table
5. `app/home.tsx`: show downloaded + bundled books, "downloading..." badge
6. Bundled books: keep 5-10 books as hardcoded imports (reduced from 20)

### Migration (existing users upgrading)
1. First launch after update: populate `content_manifest` from bundled data
2. Set `is_bundled = 1`, `version = 0` (will trigger download from server)
3. Downloaded version replaces bundled seamlessly
4. Reading progress untouched (slug-based, already in `reading_progress` table)

### Files Affected
- `src/lib/content-manager.ts` (NEW)
- `src/lib/books.ts` (major refactor)
- `src/lib/articles.ts` (major refactor)
- `src/lib/database.ts` (new table)
- `app/home.tsx` (loading state, download indicators)
- `backend/library/management/commands/publish.py` (manifest format update)

### Dependencies
- Server deploy stabil
- Manifest endpoint public (no auth) — konten bukan rahasia
- expo-file-system sudah ada di project
