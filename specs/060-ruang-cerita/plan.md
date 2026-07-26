# Plan 060 — Ruang Cerita

**Status:** Draft — menunggu approval
**Spec:** [spec.md](spec.md) (approved 2026-07-26)

Temuan dari kode existing yang menyetir plan ini:

- `MEDIA_ROOT`/`MEDIA_URL` + Pillow **sudah terpasang** — upload gambar tinggal pakai.
- Prod: Postgres + gunicorn, `ALLOWED_HOSTS` via env, nginx di depan.
- **Tidak ada** django-cors-headers — kita hindari CORS sepenuhnya dengan
  same-origin proxy (nginx `ruangcerita.ihfazh.com/api/` → gunicorn yang sama).
- Permission existing (`HasChildAccess` dkk.) berbasis `ChildAccess` — akun anak
  (tanpa `ChildAccess`) otomatis tertolak dari endpoint nested, tapi endpoint
  root (`/api/children/` create, dll.) tetap butuh guard eksplisit.
- Pola test backend: pytest per-app (`tests.py`), use-case level.

---

## 1. Data model

### 1.1 Perluasan `accounts`

```python
# Child — tambah 1 field (migrasi ringan di tabel existing)
user = OneToOneField(User, null=True, blank=True, on_delete=SET_NULL,
                     related_name="child_profile")
# Helper: is_child_account(user) → hasattr(user, "child_profile")

class PasswordSetupToken(Model):
    child       = FK(Child, related_name="setup_tokens")
    created_by  = FK(User)                  # wali yang men-generate
    code        = CharField(8, unique)      # alfabet tanpa ambigu (tanpa 0/O/1/I/l)
    expires_at  = DateTimeField()           # now + 15 menit
    used_at     = DateTimeField(null=True)
    # generate token baru → token aktif lama milik child yg sama di-void

class LoginLockout(Model):
    username     = CharField(unique)        # lockout per-username, akun anak saja
    failed_count = PositiveIntegerField(default=0)
    locked_until = DateTimeField(null=True)
```

Kebijakan password anak: validator custom `ChildPasswordValidator`
(min 6 karakter, tanpa syarat bentuk) dipakai **hanya** di alur set-password
anak; `AUTH_PASSWORD_VALIDATORS` global tidak berubah (wali tetap standar).

Lockout progresif (final, dari spec §10): 5 kegagalan beruntun → kunci 60 detik,
tiap kegagalan berikutnya durasi ×2, cap 15 menit. Reset saat login sukses.

### 1.2 App baru `diary`

```python
class PostType(Model):        # seed: puisi, pantun, cerpen, komik, curhat
    slug, label, emoji, order, is_active
    kind = CharField(choices=["text", "comic"])   # menentukan bentuk editor

class Post(Model):
    child        = FK(Child, related_name="diary_posts")
    type         = FK(PostType, on_delete=PROTECT)
    title        = CharField(200, blank=True, default="")
    body         = JSONField(null=True)   # ProseMirror JSON; null utk komik
    status       = CharField(choices=["draft", "published"], default="draft")
    published_at = DateTimeField(null=True)
    deleted_at   = DateTimeField(null=True)        # soft-delete
    created_at, updated_at

class ComicPanel(Model):
    post     = FK(Post, related_name="panels")
    order    = PositiveIntegerField()
    image    = ImageField(upload_to="diary/panels/%Y/%m/")
    caption  = CharField(500, blank=True, default="")

class Comment(Model):
    post       = FK(Post, related_name="comments")
    author     = FK(User)                  # wali atau anak pemilik
    body       = JSONField()               # ProseMirror JSON, whitelist sama
    deleted_at = DateTimeField(null=True)  # soft-delete
    created_at, updated_at

class Reaction(Model):
    post, user, emoji                      # unique(post, user, emoji)
    # set emoji final (spec §10): ❤️ 👏 🌟 😄 — divalidasi choices

class ReadReceipt(Model):
    post, user                             # unique(post, user)
    first_read_at = DateTimeField()        # → "✓ Dibaca Ayah" (wali saja)
    last_seen_at  = DateTimeField()        # → basis badge "ada yang baru"
    # dipakai dua peran: wali (read receipt + badge), anak (badge saja)

class TelegramLink(Model):
    user            = OneToOneField(User)  # wali
    chat_id         = CharField(null=True) # null = belum selesai /start
    link_code       = CharField(unique)
    code_expires_at = DateTimeField()
```

Soft-delete: manager default meng-exclude `deleted_at__isnull=False`
(`Post.objects` / `Comment.objects`), manager `all_objects` untuk admin.
Panel ikut hidup-mati dengan post-nya (saat edit, panel boleh dihapus keras —
draft/karya masih milik anak sepenuhnya).

Validasi body (ProseMirror whitelist): node `doc, paragraph, text, hardBreak`;
mark `bold, italic, textStyle{color: hex}`. Batas: 20.000 karakter teks,
kedalaman nesting 3. Fungsi validator murni + unit test — dipakai Post & Comment.

## 2. API

Semua di bawah `/api/` pada Django instance yang sama. Prefix baru: `diary/`.
Autentikasi: TokenAuthentication existing.

### 2.1 Auth & akun anak (`accounts`)

| Endpoint | Akses | Fungsi |
|---|---|---|
| `POST /api/auth/child-login/` | anon | `{username, password}` → `{token, child}`. Cek lockout; menolak akun non-anak |
| `POST /api/auth/login/` (existing) | anon | **diubah**: menolak akun anak (`child_profile`) → 403, arahkan ke child-login |
| `POST /api/children/{id}/diary-account/` | parent | Buat `User` anak: `{username}` → 201; 409 + `suggestions: []` bila bentrok (skema: `username` + 2 digit acak) |
| `POST /api/children/{id}/diary-account/setup-token/` | parent | → `{code, setup_url, expires_at}`. `setup_url` = `https://ruangcerita.ihfazh.com/setup?code=XXX` — inilah isi QR (QR dirender client wali) |
| `POST /api/auth/child-setup/` | anon | `{code, password}` → validasi token + `ChildPasswordValidator`, set password, void token, → `{token, child}` (auto-login) |
| `GET /api/diary/me/` | auth | `{role: "child"\|"guardian", child?\|children?}` — bootstrap PWA |

Guard endpoint existing (audit + pasang):

- Permission baru `IsGuardianAccount` (user login **bukan** akun anak) dipasang di
  `ChildViewSet`, `ShareInviteViewSet`, `RedeemInviteView`, `ChildAccessListView`.
- Endpoint nested (`reading`/`rewards`/`streaks`) sudah aman via `ChildAccess`,
  tapi tetap diaudit satu per satu di fase 1 (tugas eksplisit di tasks.md).

### 2.2 Konten (`diary`)

| Endpoint | Akses | Fungsi |
|---|---|---|
| `GET /api/diary/post-types/` | auth | Daftar jenis aktif |
| `GET/POST /api/diary/my/posts/` | child | Timeline sendiri (`?status=`), buat draft `{type, title?, body?}` |
| `GET/PATCH/DELETE /api/diary/my/posts/{id}/` | child pemilik | Autosave = PATCH (debounced client); publish = PATCH `{status: "published"}`; DELETE = soft |
| `POST /api/diary/my/posts/{id}/panels/` | child pemilik | Multipart upload panel; resize server-side |
| `PATCH/DELETE /api/diary/my/posts/{id}/panels/{pid}/` | child pemilik | Ubah caption/order; hapus panel |
| `GET /api/diary/feed/` | parent | Feed gabungan published semua anak yang diampu; `?child=` filter; cursor pagination; annotate `is_unread`, jumlah komentar/reaksi |
| `GET /api/diary/posts/{id}/` | parent anak ybs / child pemilik | Detail + komentar + reaksi + receipts |
| `POST /api/diary/posts/{id}/seen/` | idem | Upsert `ReadReceipt` (wali: set `first_read_at` bila baru → read receipt; semua: update `last_seen_at`). Dipanggil client saat post dibuka |
| `GET/POST /api/diary/posts/{id}/comments/` | idem | Utas flat; POST oleh wali atau anak pemilik |
| `PATCH/DELETE /api/diary/comments/{id}/` | penulis komentar | Edit/hapus (soft) milik sendiri |
| `PUT/DELETE /api/diary/posts/{id}/reactions/{emoji}/` | parent / child pemilik | Toggle reaksi idempoten |
| `GET /api/diary/badges/` | auth | Wali: `{child_id: unread_count}`; anak: post-id dengan aktivitas baru (komentar/reaksi setelah `last_seen_at`) |

Aturan permission `diary` (satu module `diary/permissions.py`):
`IsChildOwner` (user = `post.child.user`), `IsGuardianOfPost`
(`ChildAccess` role `parent` ke `post.child`). Draft hanya lolos `IsChildOwner`.
**Setiap** queryset difilter di level view — bukan hanya object permission —
agar saudara tidak bisa menebak ID (404, bukan 403).

### 2.3 Media privat (gambar panel)

Gambar komik = konten diary → **tidak boleh** dilayani sebagai `/media/` publik.

- Upload: validasi content-type + ukuran (maks 10 MB, selaras
  `DATA_UPLOAD_MAX_MEMORY_SIZE`), maks **20 panel**/post; Pillow re-encode ke
  WebP q80, sisi terpanjang 1600 px (sekalian menghapus EXIF/GPS foto kamera).
- Serving: URL bertanda-tangan `GET /api/diary/media/{panel_id}/?sig=...&exp=...`
  (django `signing`, umur 1 jam, diterbitkan di payload API). View memvalidasi
  signature → prod: `X-Accel-Redirect` ke lokasi `internal` nginx; dev: `FileResponse`.
  Dengan begitu `<img src>` biasa jalan tanpa header Authorization.

### 2.4 Telegram (`diary/telegram.py`)

- `POST /api/diary/telegram/link/` (parent) → `{deep_link}` =
  `https://t.me/<bot>?start=<link_code>`; `DELETE` untuk unlink.
- Webhook `POST /api/diary/telegram/webhook/<secret>/` — tangani `/start <code>`:
  cocokkan `link_code` aktif → isi `chat_id`, balas konfirmasi.
- Kirim notifikasi: **synchronous best-effort** di view publish/komentar
  (timeout 3 detik, try/except + log; kegagalan tidak menggagalkan request).
  Skala keluarga tidak butuh queue; upgrade path = tabel outbox + cron, dicatat
  sebagai parking, bukan v1.
- Isi pesan (spec §6.2): nama anak + label jenis + judul (bila ada) + excerpt
  **120 karakter** (diekstrak dari body JSON, teks polos). Isi penuh tidak pernah dikirim.
- Config via env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (kosong = fitur off, no-op).

## 3. Frontend — `diary-web/`

### 3.1 Stack & dependensi

Vite + React 19 + TypeScript strict + Tailwind CSS v4 + `vite-plugin-pwa`.
Runtime deps: `react-router`, `@tanstack/react-query`,
`@tiptap/react` + `starter-kit` + `@tiptap/extension-text-style` (+ color),
`qrcode.react` (render QR di layar wali). Test: vitest + testing-library.

### 3.2 Struktur

```
diary-web/
  src/
    api/        # client fetch + types (mirror kontrak §2), error handling 401→lock
    auth/       # SessionProvider: token IN-MEMORY ONLY, idle timer, quick-pick
    features/
      child/    # timeline, type-picker, editor teks, comic composer, setup(kode)
      guardian/ # feed+filter+badge, post detail, komentar/reaksi, admin anak (buat akun, QR/kode, Telegram link)
      shared/   # PostCard, renderer ProseMirror JSON, reaksi, avatar
    routes/     # /login /setup /child/* /guardian/*
```

### 3.3 Perilaku kunci sesi (spec §3)

- Token **hanya di memori** (React state) — tutup tab otomatis mati. Tidak ada
  token di localStorage/sessionStorage/cookie.
- localStorage hanya: `quickpick = [{username, name, avatar_color}]`.
- Idle timer **10 menit** (final, spec §10) → drop token, tampilkan lock screen
  (avatar + username terisi, minta password saja).
- Draft in-flight ditahan di memori editor + retry saat request gagal
  (autosave PATCH debounce 3 detik).

### 3.4 PWA

- `vite-plugin-pwa`: manifest (nama "Ruang Cerita", ikon, `display: standalone`),
  service worker **app-shell precache saja** — `NetworkOnly` untuk `/api/` dan media.

### 3.5 Dev workflow

- `npm run dev` di `diary-web/` + Vite proxy `/api` → `localhost:8123`
  (runserver dev yang sama dengan Hayya Baca; tanpa CORS di dev juga).
- Node tooling terpisah penuh dari RN root (package.json sendiri).

## 4. Deploy

- DNS: `ruangcerita.ihfazh.com` → server ksatriamuslim.
- nginx server block baru:
  - `/` → static build `diary-web/dist` (`try_files $uri /index.html`);
  - `/api/` → proxy ke upstream gunicorn existing (same-origin, tanpa CORS);
  - lokasi `internal` untuk `X-Accel-Redirect` media diary.
- Django env: tambah `ruangcerita.ihfazh.com` ke `DJANGO_ALLOWED_HOSTS`;
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
- Script `deploy-diary.sh` di root: build Vite → rsync `dist/` → server
  (pola serupa workflow deploy backend existing). Migrasi Django ikut alur
  deploy backend biasa.

## 5. Testing

Mengikuti filosofi repo: use-case level, bukan unit plumbing.

**Backend** (pytest, per journey):

- `accounts/tests.py` (extend): journey akun anak — parent buat akun → token
  setup → anak set password → login → lockout progresif → reset via token baru;
  guard: akun anak ditolak dari `/api/children/`, `/api/auth/login/`, share/redeem.
- `diary/tests.py`: (1) journey menulis — draft → autosave → publish → edit →
  soft-delete; validasi whitelist body; (2) journey privasi — saudara tidak bisa
  baca/tebak ID (404), teacher ditolak, draft tak terlihat wali; (3) journey
  interaksi — komentar dua arah, reaksi, seen/receipt, badges dua peran;
  (4) komik — upload/resize/limit panel, signed URL valid & kedaluwarsa;
  (5) telegram — link via webhook `/start`, excerpt builder (kirim di-mock).

**Frontend** (vitest, ringan): logika sesi (idle-lock, token in-memory,
quick-pick), reducer autosave/retry, renderer ProseMirror JSON. UI e2e tidak
di-v1-kan.

**Test-first** per aturan repo: tulis test gagal dulu di tiap task.

## 6. Fase implementasi

Urutan dependensi; tiap fase hijau (test pass) sebelum lanjut. Detail per-task
menyusul di `tasks.md`.

1. **Fondasi akun anak** (`accounts`): `Child.user`, `PasswordSetupToken`,
   `LoginLockout`, child-login + lockout, setup flow, `ChildPasswordValidator`,
   guard + audit endpoint existing, `GET /api/diary/me/`.
2. **Diary core** (`diary`): models + migrasi + seed `PostType`, validator body,
   CRUD post anak (draft/publish/soft-delete), permission & filter queryset.
3. **Komik & media**: upload panel, resize/re-encode, batas, signed URL +
   X-Accel-Redirect.
4. **Interaksi**: comments, reactions, seen/ReadReceipt, feed wali + badges.
5. **Telegram**: link/webhook/kirim + excerpt builder.
6. **Frontend fondasi**: scaffold `diary-web/`, SessionProvider (in-memory token,
   idle-lock, quick-pick), login anak & wali, setup via kode/QR-URL, routing dua peran.
7. **UX anak**: timeline, type-picker 5 kartu, editor TipTap + autosave,
   comic composer, publish/edit/hapus.
8. **UX wali**: feed + filter + badge, detail post + seen, komentar/reaksi,
   read receipt di sisi anak, admin (buat akun, QR/kode, link Telegram).
9. **PWA & deploy**: manifest + SW app-shell, nginx + DNS + env, `deploy-diary.sh`,
   smoke test prod.

Fase 1–5 (backend) bisa dites penuh via pytest sebelum frontend menyentuhnya;
fase 6–8 memakai backend dev port 8123 yang sudah jalan.

## 7. Risiko & mitigasi

- **Guard endpoint existing bocor** (akun anak dianggap wali) → fase 1 berisi
  audit eksplisit semua urls + test negatif per endpoint.
- **Media bocor via URL publik** → tidak ada file diary di bawah path publik;
  hanya signed URL + internal redirect (test kedaluwarsa & tanda tangan salah).
- **Regresi Hayya Baca** → perubahan pada `accounts` minimal (1 field + guard);
  suite pytest existing harus tetap hijau; `npm test` RN tidak tersentuh.
- **Telegram down/lambat** → best-effort + timeout 3 detik; produk tetap
  berfungsi penuh tanpa Telegram (badge in-app adalah sumber kebenaran).
