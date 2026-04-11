# Implementation Plan: Bookmark Buku & Artikel

**Spec**: [spec.md](./spec.md)
**Branch**: `002-bookmark-feature`
**Created**: 2026-04-11
**Status**: Implemented (PR #3)

## Scope Decisions (locked)

1. **Library UI**: **Single merged "Favorit" section** at the top of `app/home.tsx` containing both bookmarked books and articles in one mixed list (descending `updated_at`). Each row has a type indicator and routes to the correct reading screen on tap.
2. **Article priority**: Articles are the higher priority surface (ranking decay hurts articles more), but tracer bullet ships **both books and articles** end-to-end — backend/model/sync are identical; UI delta is minimal.
3. **Article backend model**: **None.** Articles come from an external API + bundled JSON. `Bookmark.content_slug` for articles is an opaque string with no FK. Server performs no validation on article slugs (same risk class as existing content).
4. **Child activation sync**: Pull **bookmarks-only** when child becomes active (not full sync). Cheaper and faster for the UI.
5. **Toggle sync**: Fire-and-forget `pushBookmarksOnly(activeChildSlug)` on toggle (NOT full `syncNow()`). UI already updated locally; network errors must not block or rollback. Full sync still runs on foreground and manual sync.

## Workflow

Per `feedback_test_first`: **Plan → Approval → Tests (red) → Implement → Green → Manual E2E**.

Tests are written first against the intended API surface; they must fail before any implementation lands.

---

## 1. Backend (Django)

Location: `backend/library/` (existing app — wraps books + articles).

### 1.1 Model — `backend/library/models.py`

```python
class Bookmark(models.Model):
    CONTENT_BOOK = 'book'
    CONTENT_ARTICLE = 'article'
    CONTENT_CHOICES = [(CONTENT_BOOK, 'Book'), (CONTENT_ARTICLE, 'Article')]

    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='bookmarks')
    content_type = models.CharField(max_length=16, choices=CONTENT_CHOICES)
    content_slug = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        unique_together = [('child', 'content_type', 'content_slug')]
        indexes = [models.Index(fields=['child', 'is_deleted'])]
```

### 1.2 Migration
- `backend/library/migrations/0003_bookmark.py` (auto-generated).

### 1.3 Serializer — `backend/library/serializers.py`
- `BookmarkSerializer`: `content_slug` as plain `CharField` (same pattern as reading progress).
- Fields: `content_type`, `content_slug`, `is_deleted`, `created_at`, `updated_at`.

### 1.4 Views — `backend/library/views.py`

- **`BookmarkPushView`** (POST `/api/bookmarks/push/`)
  - Auth required.
  - Body: `{ child_slug, bookmarks: [{content_type, content_slug, is_deleted, updated_at}, …] }`
  - Filters child to `request.user`'s children only (reject others).
  - Upsert by `(child, content_type, content_slug)`; respects `is_deleted` flag; last-write-wins by `updated_at` to stay idempotent under retries.
- **`BookmarkPullView`** (GET `/api/bookmarks/?child_slug=…`)
  - Returns `is_deleted=False` rows for that child, ordered `-updated_at`.
  - Shape mirrors push body for easy client apply.

### 1.5 URLs & Admin
- Register both endpoints in `backend/library/urls.py` → included in project urls.
- `admin.site.register(Bookmark)` for debugging.

---

## 2. RN Local Storage

### 2.1 SQLite table — `src/lib/database.ts` (append to existing schema init, additive `CREATE TABLE IF NOT EXISTS` pattern already in use)

```sql
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_slug TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER,
  UNIQUE(child_id, content_type, content_slug)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_child_active
  ON bookmarks(child_id, is_deleted);
```

### 2.2 Helper — `src/lib/bookmarks.ts` (new file)

Public API:
- `toggleBookmark(childId, contentType, contentSlug): Promise<boolean>` — returns new bookmarked state. Upserts row, flips `is_deleted`, bumps `updated_at = Date.now()`, clears `synced_at`.
- `isBookmarked(childId, contentType, contentSlug): Promise<boolean>`
- `listBookmarks(childId, contentType): Promise<Bookmark[]>` — non-deleted, ordered `updated_at DESC`.
- `getDirtyBookmarks(): Promise<Bookmark[]>` — rows where `synced_at IS NULL OR synced_at < updated_at`.
- `markSynced(ids, ts)`
- `applyServerBookmarks(childId, rows)` — server-wins **only** for rows where `synced_at IS NOT NULL AND synced_at >= updated_at` (i.e. locally clean). Dirty rows (pending push) are never clobbered. This is the single source of truth for the rule; see also Risk §10.1.

## 3. API Client — `src/lib/api.ts`

- `pushBookmarks(childSlug, entries)` → `POST /api/bookmarks/push/`
- `pullBookmarks(childSlug)` → `GET /api/bookmarks/?child_slug=…`
- `pushBookmarksOnly(childSlug)` — convenience wrapper used by the toggle trigger: gathers dirty bookmarks for that child, pushes, and marks synced. No pull, no progress/rewards. Exposed from `src/lib/sync.ts` (not api.ts) since it composes DB + API calls.

Token read from existing `settings` table; same auth pattern as other endpoints.

---

## 4. Sync Integration — `src/lib/sync.ts`

### 4.1 Extend main sync pass
After existing push progress/rewards step:
1. `getDirtyBookmarks()` grouped by child → `pushBookmarks` per child.
2. On success → `markSynced`.
3. `pullBookmarks(activeChildSlug)` → `applyServerBookmarks`.
4. Log as SyncLog step `bookmarks`.

Idempotent; safe to call repeatedly.

### 4.2 New triggers
- **On toggle**: reading screen fires `pushBookmarksOnly(activeChildSlug)` (bookmarks-only push) non-blocking, wrapped in try/catch that never throws. Does NOT call full `syncNow()` — avoids heavy sync on frequent star taps.
- **On child activation**: in child-select flow (`app/index.tsx`), after `selectChild(child)`, fire `syncBookmarksForChild(child.id)` non-blocking before `router.push("/home")` — pushes any dirty + pulls active.

### 4.3 Failure semantics
- Local DB is source of truth for UI.
- Network failures logged to SyncLog; never surface to child UI.
- Parent dashboard manual sync button already covers recovery.

---

## 5. UI

### 5.1 Component — `src/components/BookmarkStar.tsx` (new)
- Props: `{ bookmarked: boolean, onToggle: () => void, size? }`
- Visual: outline star when false, filled yellow star when true.
- Controlled component; parent owns state.

### 5.2 Reading screen — `app/read/[bookId].tsx`
- On mount: load `isBookmarked(activeChildId, 'book', bookId)` → local state.
- Place `<BookmarkStar>` in screen header (right side).
- On tap:
  1. Optimistic flip local state.
  2. `await toggleBookmark(...)`.
  3. Fire `pushBookmarksOnly(activeChildSlug)` (non-blocking, error-swallowed).

### 5.3 Article screen — `app/article/[articleId].tsx`
- Same pattern, `content_type='article'`, slug = article id.
- **Articles ship first** per priority, but both in the same PR.

### 5.4 Library — merged Favorit section in `app/home.tsx`
- Add a **single "Favorit" section** at the top of `app/home.tsx` that renders both bookmarked books and articles together in one mixed list.
- Query: `listBookmarks(activeChildId)` (no content_type filter), ordered `updated_at DESC`, joined with book metadata (from `src/lib/books.ts`) and article metadata (from `src/lib/articles.ts`).
- Each row has a visual type indicator (e.g. small badge "Buku" / "Artikel") and taps route to `/read/[bookId]` or `/article/[articleId]`.
- Empty state card: "Belum ada favorit. Tekan bintang saat membaca!"
- Refreshes when screen gains focus (`useFocusEffect`) — catches post-sync updates.
- Section is hidden / collapses cleanly if no bookmarks exist for the active child (empty state still shown inside section for discoverability on first use — TBD in implementation, default to showing empty state).

---

## 6. Tests — `src/__tests__/` (use-case level)

Written **before** implementation; must be red first.

### 6.1 `usecase-bookmark-toggle.test.tsx`
- Scenarios:
  - Open reading screen for article → star outline.
  - Tap star → star filled, row in `bookmarks` table with `is_deleted=0`.
  - Tap again → star outline, row flipped to `is_deleted=1`.
  - Sync called but network mocked to throw → local state unaffected (fail-safe).
- Covers articles (priority) AND books.

### 6.2 `usecase-bookmark-list.test.tsx`
- Toggle article bookmark → open home → merged Favorit section shows that article at top with "Artikel" indicator.
- Toggle a book bookmark → merged Favorit section now shows both items mixed, most recently bookmarked first.
- Tap a book row → routes to `/read/[bookId]`; tap an article row → routes to `/article/[articleId]`.
- Switch active child → Favorit section empty for the new child (per-child isolation).
- Empty state copy visible when no bookmarks exist.

Mocks:
- API layer mocked (no real network).
- SQLite uses existing in-memory test setup.
- Sync module stubbed to record calls without executing.

---

## 7. Execution Order

1. Write both test files (red).
2. Backend: model → migration → serializer → views → urls → admin.
3. RN DB: add `bookmarks` table + migration guard in `database.ts`.
4. `src/lib/bookmarks.ts` helper.
5. `src/lib/api.ts` push/pull functions.
6. `src/lib/sync.ts` extension + child-activation trigger.
7. `BookmarkStar` component.
8. Wire into article reading screen (priority), then book reading screen.
9. Merged Favorit section in `app/home.tsx` (single list, mixed book+article rows).
10. Run tests → green.
11. Manual E2E (see §8).
12. `npm test` must pass before build.

## 8. Manual E2E Checklist

- [x] Toggle bookmark on article → star flips, appears in merged Favorit section at top of home.
- [x] Toggle bookmark on book → also appears in the same merged Favorit section, mixed with article, newest first.
- [x] Tap book row routes to `/read/[bookId]`; tap article row routes to `/article/[articleId]`.
- [x] Unbookmark → disappears from Favorit section.
- [x] Airplane mode → toggle still works, star state persists across app restart.
- [x] Re-enable network → `syncNow` pushes pending bookmarks (check SyncLog).
- [x] Login on second device → Favorit section populates after sync.
- [x] Switch child A → B → Favorit section shows B's bookmarks only, then auto-refreshes from server.
- [x] Uninstall + reinstall + login → bookmarks return after sync.
- [x] Reading flow unchanged; no regression in existing sync.

## 9. Out of Scope (Iterasi Lanjut)

- Star animation on toggle.
- Bulk bookmark operations.
- Parent dashboard bookmark view.
- Quick bookmark from library list items (only reading screen for now).
- Bookmark for Quiz / GameZone.
- Folders/categories, sharing, notifications.

## 10. Open Risks

- **Dirty-row preservation during pull**: `applyServerBookmarks` must not clobber local rows that haven't synced yet. Strategy: only overwrite rows where `synced_at IS NOT NULL AND synced_at >= updated_at`.
- **Clock skew**: `updated_at` uses device time. Acceptable for tracer; server-side last-write-wins resolves conflicts on push.
- **Article slug stability**: assumed stable (same assumption as reading progress sync). If articles ever get re-slugged, bookmarks may orphan — same risk as existing sync, not new.
