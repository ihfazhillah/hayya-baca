# Manifest-Driven Content Download

## Goal
Semua konten (buku + artikel) dari server sebagai single source of truth.
Bundled content dihilangkan. App fetch manifest → download content → simpan lokal.

## Current State
- Buku: 20 buku hardcoded di `books.ts` (bundled JSON)
- Artikel: fetch dari API kalau online, fallback ke 10 bundled + SQLite cache
- Manifest: sudah ada `publish` management command yang generate `manifest.json`

## Architecture

### Manifest Format (server)
```json
{
  "version": 42,
  "updated_at": "2026-03-14T12:00:00Z",
  "books": [
    {
      "id": 1,
      "slug": "1",
      "title": "Sahabat yang disebut namanya di langit",
      "version": 3,
      "min_age": 5,
      "categories": ["Kisah Sahabat"],
      "content_hash": "sha256:abc123..."
    }
  ],
  "articles": [
    {
      "id": 28,
      "slug": "article-112",
      "title": "Lelaki Anshar dengan Tiga Anak Panah",
      "version": 2,
      "min_age": 8,
      "categories": ["Kisah Sahabat"],
      "content_hash": "sha256:def456..."
    }
  ]
}
```

### App Flow

```
App Open
  ├── Load local manifest (SQLite/JSON)
  ├── Fetch server manifest
  ├── Compare versions per item
  ├── Download changed/new items
  │   ├── GET /media/published/books/{slug}.json
  │   └── GET /media/published/articles/{slug}.json
  ├── Save to local storage (expo-file-system)
  ├── Update local manifest
  └── App uses local content (offline-capable)
```

### Migration Path (Bundled → Server-Only)

**Phase 1: Hybrid (bundled + server)**
- Keep bundled as fallback for first launch / offline
- Fetch manifest on app open
- Download new/updated content
- Prefer downloaded over bundled

**Phase 2: Server-Only**
- Remove bundled imports dari `books.ts` dan `articles.ts`
- First launch: show loading, download semua content
- Subsequent: incremental update via manifest version compare
- Offline: pakai last-downloaded content

### Key Decisions Needed
1. **Storage**: expo-file-system (DocumentDirectory) vs SQLite blob?
   - Recommendation: expo-file-system untuk JSON files, SQLite untuk manifest index
2. **Download strategy**: all-at-once vs lazy (download saat user buka)?
   - Recommendation: download manifest + metadata on open, lazy download content saat user buka buku/artikel
3. **Cache invalidation**: content_hash vs version number?
   - Recommendation: version number (simpler), hash sebagai integrity check
4. **Offline-first**: berapa lama cache valid?
   - Recommendation: indefinite, selalu pakai local, update di background
5. **Progress key stability**: slug berubah → progress orphaned?
   - Recommendation: slug immutable setelah publish, server enforce

### Server Changes
1. `publish` command: include `content_hash` di manifest
2. `publish` command: include `slug` di manifest entries
3. Static file serving: `/media/published/books/{slug}.json`, `/media/published/articles/{slug}.json`
4. API: optional, manifest bisa di-serve langsung sebagai static file

### App Changes
1. `src/lib/content-manager.ts` (NEW): manifest fetch, version compare, download orchestration
2. `src/lib/books.ts`: refactor dari hardcoded imports → read from local storage
3. `src/lib/articles.ts`: refactor dari bundled fallback → local storage only
4. `src/lib/database.ts`: table `content_manifest` (slug, type, version, local_path, downloaded_at)
5. Loading UI: progress indicator saat download content
6. Error handling: retry, partial download resume

### Files Affected
- `src/lib/content-manager.ts` (NEW)
- `src/lib/books.ts` (major refactor)
- `src/lib/articles.ts` (major refactor)
- `src/lib/database.ts` (new table)
- `app/home.tsx` (loading state)
- `backend/library/management/commands/publish.py` (manifest format)

### Timeline Estimate
- Phase 1 (hybrid): medium effort
- Phase 2 (server-only): depends on Phase 1, remove bundled imports

### Dependencies
- Server harus sudah deploy dan stabil
- Manifest endpoint accessible tanpa auth (public content)
- expo-file-system sudah ada di project
