# Feature Specification: Bookmark Buku & Artikel

**Feature Branch**: `002-bookmark-feature`
**Created**: 2026-04-11
**Status**: Implemented (PR #3)
**Input**: Anak-anak ingin menyimpan buku/artikel favorit supaya bisa dibaca lagi nanti. Saat ini tidak ada fitur bookmark, dan ranking artikel yang sudah dibaca turun jauh, sehingga artikel menarik sulit ditemukan kembali.

## Problem Statement

Ksatria Muslim (Hayya Baca) menampilkan buku dan artikel dengan ranking dinamis. Setelah anak membaca satu konten, ranking-nya turun di daftar — ini wajar untuk mendorong eksplorasi konten baru, tetapi menyebabkan anak kehilangan akses cepat ke bacaan yang mereka sukai. Tidak ada mekanisme bagi anak untuk menandai konten favorit.

### Dampak
- Anak harus scroll jauh / mencari manual untuk menemukan kembali bacaan favorit.
- Orang tua tidak punya visibilitas apa saja yang benar-benar disukai anak.
- Anak cenderung berhenti membaca ulang konten yang menarik karena sulit dicari.

## Goals

1. Anak bisa menandai (bookmark) buku dan artikel saat sedang membacanya.
2. Anak bisa melihat daftar bookmark mereka sendiri di halaman library.
3. Bookmark per-child, tersinkron ke backend sehingga tidak hilang antar device.
4. Tidak mengubah algoritma ranking artikel yang sudah ada.

## Non-Goals

- Tidak mengubah logika ranking / decay artikel.
- Tidak ada folder/kategori bookmark.
- Tidak ada bookmark untuk Quiz / GameZone (iterasi lain).
- Tidak ada fitur "share bookmark" antar child atau antar user.
- Tidak ada reminder / notifikasi terkait bookmark.

## User Stories

### US-1: Menandai bacaan favorit
Sebagai anak yang sedang membaca buku/artikel, saya ingin menekan icon bintang di header reading screen agar konten tersebut masuk ke daftar favorit saya.

**Acceptance:**
- Ada icon bintang (outline/filled) di header `reading` screen untuk buku dan artikel.
- Tap → toggle status bookmark; state visual langsung update (optimistic).
- Status tersimpan ke DB lokal segera; tidak perlu menunggu network.

### US-2: Melihat daftar bookmark
Sebagai anak yang ingin membaca ulang konten favorit, saya ingin membuka section "Favorit" di library agar dapat langsung menemukannya.

**Acceptance:**
- Library screen (`app/home.tsx`) menampilkan **satu section "Favorit" merged** di bagian atas yang berisi buku + artikel bookmark child aktif dalam satu list campuran.
- Tiap item punya indikator tipe (buku/artikel) dan tap langsung ke reading/article screen yang sesuai.
- Jika kosong, tampilkan empty state ramah anak ("Belum ada favorit. Tekan bintang saat membaca!").
- Urutan: terbaru di-bookmark di atas.

### US-3: Sinkronisasi antar device
Sebagai orang tua yang memiliki lebih dari satu device, saya ingin bookmark anak tetap sama di semua device setelah sync.

**Acceptance:**
- Bookmark di-push ke backend mengikuti pola sync existing (push-first on foreground/manual sync, idempotent).
- Server menjadi source of truth saat pull.
- Unbookmark juga ter-sync (bukan hanya add).

### US-4: Per-child isolation
Sebagai keluarga dengan beberapa anak, saya ingin bookmark tiap anak terpisah agar tidak tercampur.

**Acceptance:**
- Bookmark tersimpan dengan `child_id`.
- Library section "Favorit" hanya menampilkan bookmark untuk child yang sedang aktif.

## Functional Requirements

### FR-1: Data Model (Backend)
Model baru `Bookmark`:
- `child` (FK ke Child)
- `content_type` — enum: `book` | `article`
- `content_slug` — untuk `book`, slug dari Book (pattern sama dengan reading progress sync). Untuk `article`, string opaque — tidak ada Article model di backend (artikel datang dari external API + bundled JSON), jadi tidak ada FK validation.
- `created_at`
- `updated_at`
- `is_deleted` (soft delete untuk handle unbookmark via sync)
- Unique constraint: `(child, content_type, content_slug)`

### FR-2: API Endpoints
Mengikuti pola `src/lib/api.ts` existing:
- `POST /api/bookmarks/push/` — body: list of bookmark entries (idempotent upsert). Mendukung add & delete (via `is_deleted` flag).
- `GET /api/bookmarks/?child_slug=…` — pull bookmark untuk child tertentu.
- Auth via token existing.

### FR-3: Local Storage (RN)
- Table SQLite baru `bookmarks` dengan kolom sama seperti model backend + `synced_at`.
- Schema ditambahkan di `src/lib/database.ts` (pattern additive `CREATE TABLE IF NOT EXISTS` yang sudah ada).
- CRUD lewat helper baru `src/lib/bookmarks.ts`.

### FR-4: Sync Integration
- Extend `src/lib/sync.ts`: setelah push progress/rewards, push bookmarks, lalu pull bookmarks for active child.
- Idempotent — aman jika dipanggil berkali-kali.
- Tercatat di SyncLog.
- **Trigger sync**:
  1. Setiap kali anak toggle bookmark → panggil `pushBookmarksOnly(activeChildSlug)` (bookmarks-only push, bukan full `syncNow()`) — non-blocking, fail-safe, agar tap bintang tidak memicu sync berat.
  2. Setiap kali child menjadi aktif (switch child di child select screen) — pull bookmarks dari server supaya library langsung up-to-date.
  3. Tetap ikut sync umum (full pass) saat foreground / manual sync.

### FR-5: UI — Reading Screen
- Icon bintang di header `app/read/[bookId].tsx` (untuk buku) dan `app/article/[articleId].tsx` (untuk artikel).
- State: outline = not bookmarked, filled (kuning) = bookmarked.
- Tap → toggle lokal + mark dirty untuk sync berikutnya.

### FR-6: UI — Library Section (Merged Favorit)
- Library tinggal di satu screen `app/home.tsx` yang menampung books dan articles.
- Tambah **satu section "Favorit" yang merged** di atas list utama — menampilkan buku + artikel yang dibookmark child aktif dalam satu list campuran.
- Tiap item mencantumkan indikator visual tipe konten (buku vs artikel) dan tap langsung membuka reading/article screen yang sesuai.
- Urutan: terbaru di-bookmark di atas (descending `updated_at`).
- Hanya show untuk child aktif.
- Empty state ramah anak bila belum ada.

## Tracer Bullet Scope

Tracer bullet ini **end-to-end minimal**, menyentuh semua layer tapi thin:

1. **Backend**: model + migration + 2 endpoint (push & pull) + admin register. 1 serializer, 1 view.
2. **RN**: SQLite table + bookmarks helper + API client functions + extend sync + 1 toggle button component + section di library (buku dulu, artikel setelahnya bila waktu mengizinkan).
3. **Test**: 1 use-case test untuk toggle bookmark, 1 untuk list favorit.

Yang **TIDAK** masuk tracer bullet awal (iterasi lanjut):
- Animasi toggle bintang.
- Bulk operations.
- Parent dashboard view untuk bookmark.
- Export/share.

## Resolved Decisions

- **No limit** bookmark per child.
- **Re-fetch on child activation**: setiap kali child jadi aktif, pull bookmarks dari server (lihat FR-4).
- **Sync on toggle**: setiap add/remove bookmark memicu sync non-blocking (lihat FR-4).
- **Quick bookmark dari list item**: out of scope tracer bullet; icon bintang hanya di reading screen dulu.

## Success Criteria

- Anak bisa toggle bookmark di reading screen dan langsung melihat hasilnya di section "Favorit".
- Uninstall/install ulang + login → bookmark kembali muncul setelah sync.
- Bookmark child A tidak muncul di library saat child B aktif.
- Tidak ada regresi di flow reading / sync existing.
