# Plan 063 — Peningkatan Ruang Cerita (teknis)

**Status:** Draft — menunggu approval
**Spec:** [spec.md](spec.md)

Prinsip: perubahan kecil & terisolasi per fitur; test-first; suite hijau tiap
commit. Backend = Django `diary`/`accounts`, FE = `diary-web/` (React+Vite).

## 1. Backend

### 1.1 F7 — `resolved_at` + endpoint resolve
- `diary/models.py`: `Post.resolved_at = DateTimeField(null=True, blank=True)`.
- Migrasi `diary/migrations/0004_post_resolved_at.py` (auto).
- `diary/views.py` `PostResolveView(APIView)` `[IsAuthenticated, IsGuardianAccount]`:
  - `POST`: resolusi hanya bila `post.type.slug == "curhat"` (else 400);
    `resolve_accessible_post` untuk cek kepemilikan; set `resolved_at=now`.
  - `DELETE`: set `resolved_at=None`.
  - Response: `{ "resolved_at": … }`.
- `diary/urls.py`: `posts/<int:post_pk>/resolve/`.
- `diary/serializers.py`: `PostSerializer` + `FeedItemSerializer` (via
  `post_detail_payload`) expose `resolved_at` (read-only). Tambah `is_resolved`
  (computed) di payload feed/detail.

### 1.2 F6 + F7 — filter feed
- `FeedView.get_queryset`:
  - param `type` → `.filter(type__slug=type)`.
  - default `.exclude(resolved_at__isnull=False)` (sembunyikan resolved).
  - param `resolved=1` → override: **hanya** `resolved_at__isnull=False`.
  - `child` (sudah ada) tetap.

### 1.3 F5 — verifikasi (kemungkinan tanpa perubahan)
- Pastikan `MyPostViewSet.perform_update` untuk post `published`: tidak
  set `published_at` ulang (sudah: `first_publish` cek `published_at is None`),
  tidak `_notify` (sudah). Test regresi mengunci perilaku ini.

## 2. Frontend — API layer

- `api/types.ts`:
  - `Post`/`PostDetail`/`FeedItem`: tambah `resolved_at: string | null`.
- `api/endpoints.ts`:
  - `feed({ child?, type?, resolved?, cursor? })` → query `type`, `resolved`.
  - `resolvePost(id)` = `PUT`/`POST` `/posts/<id>/resolve/`;
    `unresolvePost(id)` = `DELETE`.

## 3. Frontend — komponen

### F1 — `features/shared/CommentThread.tsx`
- `Composer`: `<textarea>` auto-grow (rows dinamis), Enter=newline, tombol Kirim.
- `plainDoc(text)`: `text.split('\n')` → `paragraph[]` (baris kosong = paragraph
  kosong diperbolehkan; trim keseluruhan dulu untuk cek non-empty).

### F2 — `features/shared/ui.tsx`
- `PasswordInput`: bungkus `TextInput`, state `show`, tombol mata (👁/🙈)
  absolute di kanan; `type = show ? 'text' : 'password'`.
- Ganti input password di `Lobby.tsx` (PasswordPrompt) & `routes/SetupPage.tsx`.

### F3+F4 — reset via scan
- `features/shared/QrScanner.tsx` (baru): buka kamera (`getUserMedia`), loop
  `BarcodeDetector.detect` → callback `onCode(text)`. Jika `BarcodeDetector`
  tak ada → render pesan "perangkat tak mendukung scan, ketik kode" + link `/setup`.
- `Lobby.tsx` PasswordPrompt (child): link "Lupa kata sandi? Scan QR" →
  buka scanner → dari URL hasil scan ekstrak `?code=` → `navigate('/setup?code=…')`.
- Helper `parseSetupCode(url)`: ambil query `code` dari URL/string.
- `Admin.tsx`: relabel tombol jadi "Reset kata sandi (kode + QR)".

### F5 — `features/child/Editor.tsx` + `ChildPostDetail.tsx`
- Editor menerima `published` (dari detail). Bila terbit:
  - sembunyikan tombol "Terbitkan"; ganti header jadi "Selesai" → `navigate(/post/:id)`.
  - autosave tetap jalan (title/body) via `updatePost`.
- Detail: "Ubah" untuk post terbit sudah route ke Editor — pertahankan.

### F6 + F7 — `features/guardian/Feed.tsx` + `GuardianPostDetail.tsx`
- `Feed`: state `typeFilter: string | null` + `resolvedView: boolean`.
  - baris chip tipe dari `usePostTypes()`. Chip "Curhat" bisa buka sub-filter
    "Belum selesai / Selesai" (atau chip "Selesai" global saat curhat aktif).
  - `useInfiniteQuery` key `['feed', child, type, resolved]`;
    `api.feed({ child, type, resolved })`.
- `FeedPost` (curhat, belum resolved): tombol "Tandai selesai" → `resolvePost`
  → invalidate `['feed']`. Di tampilan "Selesai": tombol "Buka lagi" → unresolve.
- `GuardianPostDetail`: tombol resolve serupa untuk curhat.

### F8 — sesi persist
- `auth/sessionStore.ts`:
  - const `TRUSTED_KEY='ruangcerita.trusted'`, `GUARDIAN_KEY='ruangcerita.guardian'`.
  - `trusted: boolean` (load saat construct). Method `setTrusted(on)`:
    on → simpan `active` guardian saat ini; off → hapus `GUARDIAN_KEY`.
  - `enterGuardian`: bila `trusted` → persist `{token, me}`.
  - construct: bila `trusted` & ada guardian tersimpan → `active = guardian`
    (skip lobby). `resetIdle` no-op saat `trusted`.
  - `logout`/`lock`: hapus `GUARDIAN_KEY` (lock hanya bila !trusted; saat trusted
    idle-lock tak dipasang, tapi 401 tetap memanggil `lock` → bersihkan).
  - `SessionState` tambah `trusted`.
- `SessionProvider.tsx`: expose `setTrusted`, `state.trusted`.
- UI: halaman/section pengaturan ortu (mis. di `TelegramSettings.tsx` atau tab
  "Kelola") — toggle "Ingat di perangkat ini (perangkat orang tua)".

## 4. Test

Backend (`diary/tests.py`, pytest):
- F7: guardian resolve curhat → `resolved_at` set; non-curhat → 400; anak lain
  tak bisa; feed default menyembunyikan resolved; `?resolved=1` menampilkannya.
- F6: `?type=puisi` hanya puisi.
- F5: anak update post terbit → 200, `published_at` tak berubah, tak ada notify.

Frontend (Vitest):
- F1: `plainDoc` multi-baris → 2 paragraph; render 2 `<p>`.
- F3: `parseSetupCode(url)` benar.
- F8: `sessionStore` trusted → persist & restore guardian; non-trusted → tidak.

## 5. Risiko & catatan

- `BarcodeDetector` tak ada di semua browser → wajib fallback ketik kode.
- Migrasi `resolved_at` → `deploy-diary.sh` menjalankan `migrate` (source `.env`).
- Token guardian di localStorage (F8) → hanya saat toggle ON; dokumentasikan.
- Filter feed + resolve harus konsisten dengan cursor pagination (`published_at`).
