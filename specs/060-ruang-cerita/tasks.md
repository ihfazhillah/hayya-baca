# Tasks 060 — Ruang Cerita

**Status:** Draft — menunggu approval
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) (approved 2026-07-26)

Aturan pengerjaan:

- **Test-first** per task backend: tulis test yang FAIL dulu, baru implementasi.
- Satu task = satu commit (`feat(diary): T2.3 <desc>` / `feat(accounts): ...`).
- Suite pytest existing + `npm test` RN harus tetap hijau di setiap commit.
- Checklist dicentang (`[x]`) saat task selesai; fase ditutup hanya jika semua
  task-nya hijau.

---

## Fase 1 — Fondasi akun anak (`accounts`)

- [x] **T1.1 — Migrasi `Child.user` + helper**
  OneToOne nullable ke `User` (`related_name="child_profile"`, `on_delete=SET_NULL`).
  Helper `is_child_account(user)`. Test: buat user-anak ter-link, helper benar
  untuk wali/anak/anonim.

- [x] **T1.2 — Model `PasswordSetupToken` + `LoginLockout`**
  Sesuai plan §1.1 (kode 8 char alfabet non-ambigu, expire 15 menit, void token
  lama saat generate baru). Test: generate → void lama; expire; single-use.

- [x] **T1.3 — `ChildPasswordValidator`**
  Min 6 karakter, bebas bentuk; dipakai hanya di alur set-password anak.
  Test: "kucing1" & "123456" lolos; "abc" ditolak; validator global tak berubah.

- [x] **T1.4 — `POST /api/children/{id}/diary-account/`** (parent)
  Buat user anak `{username}`; username unik global; 409 + `suggestions`
  (nama + 2 digit acak) saat bentrok. Test: sukses, bentrok+saran, teacher
  ditolak, non-wali ditolak.

- [x] **T1.5 — `POST .../diary-account/setup-token/`** (parent)
  → `{code, setup_url, expires_at}`. Test: hanya parent; token lama ter-void.

- [x] **T1.6 — `POST /api/auth/child-setup/`** (anon)
  `{code, password}` → set password (T1.3), void token, balas `{token, child}`.
  Test: happy path; kode salah/expired/terpakai; dipakai untuk setup awal DAN reset.

- [x] **T1.7 — `POST /api/auth/child-login/` + lockout progresif**
  5 gagal → 60 dtk, ×2 per gagal berikut, cap 15 menit, reset saat sukses;
  menolak akun non-anak. Test: journey lockout penuh (freeze time), reset,
  wali ditolak di endpoint ini.

- [x] **T1.8 — Guard endpoint existing + audit**
  Permission `IsGuardianAccount` di `ChildViewSet`, `ShareInviteViewSet`,
  `RedeemInviteView`, `ChildAccessListView`; `POST /api/auth/login/` menolak
  akun anak (403). Audit semua urls nested (`reading`/`rewards`/`streaks`) —
  catat hasil audit di komentar PR/commit. Test negatif: akun anak ditolak di
  tiap endpoint tersebut.

- [x] **T1.9 — `GET /api/diary/me/`**
  `{role, child?|children?}`. Test: anak, wali (multi-anak), teacher
  (`children: []` — tidak melihat apa pun).

## Fase 2 — Diary core (`diary`)

- [ ] **T2.1 — App `diary` + models + migrasi + seed**
  `PostType, Post, ComicPanel, Comment, Reaction, ReadReceipt, TelegramLink`
  (plan §1.2), soft-delete manager, data migration seed 5 `PostType`
  (kind text/comic). Test: manager exclude deleted; seed ada.

- [ ] **T2.2 — Validator body ProseMirror**
  Whitelist node/mark + batas 20k char & depth 3 (fungsi murni).
  Test: dokumen valid; node liar ditolak; mark liar ditolak; oversize ditolak.

- [ ] **T2.3 — CRUD post anak** (`/api/diary/my/posts/`)
  List (filter status), create draft, PATCH (autosave/publish — set
  `published_at`), DELETE soft. `GET /api/diary/post-types/`. Test: journey
  draft→autosave→publish→edit→hapus; body tervalidasi via T2.2; komik boleh
  body null.

- [ ] **T2.4 — Permission & isolasi queryset**
  `IsChildOwner`, `IsGuardianOfPost`; filter di queryset (404, bukan 403).
  Test journey privasi: saudara tak bisa list/GET/tebak-ID; teacher ditolak;
  wali tak melihat draft; wali anak lain ditolak.

## Fase 3 — Komik & media

- [ ] **T3.1 — Upload panel + resize**
  `POST .../panels/` multipart; validasi tipe & ≤10 MB; maks 20 panel;
  re-encode WebP q80 sisi ≤1600 px (EXIF terbuang). PATCH caption/order,
  DELETE panel. Test: upload+resize, limit panel, tipe salah ditolak, reorder.

- [ ] **T3.2 — Signed URL + serving privat**
  URL `/api/diary/media/{panel_id}/?sig&exp` (umur 1 jam) di payload API;
  view validasi → dev `FileResponse`, prod `X-Accel-Redirect`. Test: URL valid
  melayani file; expired/tanda-tangan salah → 403; tanpa sig → 403.

## Fase 4 — Interaksi

- [ ] **T4.1 — Comments** (`.../comments/`, edit/hapus milik sendiri, soft-delete)
  Body pakai validator T2.2. Test: journey dua arah wali↔anak; anak lain
  ditolak; edit/hapus hanya penulis.

- [ ] **T4.2 — Reactions** (PUT/DELETE toggle idempoten, choices ❤️ 👏 🌟 😄)
  Test: toggle, emoji liar ditolak, unique per user+post+emoji.

- [ ] **T4.3 — Seen & ReadReceipt** (`POST .../seen/`)
  Upsert: wali set `first_read_at` sekali + `last_seen_at`; anak hanya
  `last_seen_at`. Detail post memuat receipts ("Dibaca Ayah"). Test: receipt
  muncul untuk anak; first_read tidak berubah di kunjungan kedua.

- [ ] **T4.4 — Feed wali + detail + badges**
  `GET /api/diary/feed/` (gabungan, `?child=`, cursor, annotate `is_unread` +
  jumlah komentar/reaksi); `GET /api/diary/posts/{id}/`;
  `GET /api/diary/badges/` dua peran. Test: feed multi-anak terurut; unread
  benar setelah seen; badge anak muncul saat ada komentar baru → hilang
  setelah seen.

## Fase 5 — Telegram

- [ ] **T5.1 — Link & webhook**
  `POST/DELETE /api/diary/telegram/link/`; webhook `/start <code>` mengisi
  `chat_id`. Env `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET` (kosong = no-op).
  Test: link journey via webhook; kode expired; secret salah → 404.

- [ ] **T5.2 — Pengiriman + excerpt builder**
  Trigger: publish post & komentar anak → kirim ke semua wali ter-link
  (sync, timeout 3 dtk, best-effort). Excerpt 120 char dari body JSON;
  format: nama + jenis + (judul) + excerpt. Test: excerpt builder (judul/
  tanpa judul/komik tanpa body); pengiriman di-mock — payload benar, kegagalan
  kirim tidak menggagalkan publish.

## Fase 6 — Frontend fondasi (`diary-web/`)

- [ ] **T6.1 — Scaffold**
  Vite + React + TS strict + Tailwind v4 + vite-plugin-pwa + router + react-query;
  struktur folder plan §3.2; Vite proxy `/api`→8123; vitest jalan; lint/`tsc` script.

- [ ] **T6.2 — API client + types**
  Fetch wrapper (token header, error handling, 401 → lock), types mirror
  kontrak plan §2. Test (vitest): 401 memicu lock, retry autosave.

- [ ] **T6.3 — SessionProvider**
  Token in-memory only; idle timer 10 menit → lock screen; quick-pick
  localStorage (username+nama+avatar). Test: idle→lock, tutup-tab semantics
  (tidak ada persist), quick-pick CRUD.

- [ ] **T6.4 — Alur masuk**
  Layar login (quick-pick anak + form wali), lock screen, `/setup?code=` (set
  password anak → auto-login), routing per role dari `/api/diary/me/`.

## Fase 7 — UX anak

- [ ] **T7.1 — Timeline sendiri** (draft & published, status jelas, tombol besar "Aku mau nulis…")
- [ ] **T7.2 — Type-picker** 5 kartu (dari `/post-types/`) → editor sesuai `kind`.
- [ ] **T7.3 — Editor teks TipTap**
  Toolbar besar: bold/italic/warna/emoji; autosave debounce 3 dtk + indikator
  "tersimpan"; retry in-memory saat offline; publish; judul opsional.
- [ ] **T7.4 — Comic composer**
  Ambil foto/file per panel, urutkan, caption, hapus panel, publish.
- [ ] **T7.5 — Post detail sisi anak**
  Baca karya + komentar wali, balas, reaksi, lihat "✓ Dibaca Ayah/Ibu";
  edit/hapus karya sendiri (konfirmasi hapus).

## Fase 8 — UX wali

- [ ] **T8.1 — Feed gabungan** + chip filter per anak + badge unread (poll `badges/`).
- [ ] **T8.2 — Post detail wali**: render body/panel (signed URL), panggil
  `seen/` saat buka, komentar + reaksi.
- [ ] **T8.3 — Admin anak**: buat akun diary (username + saran), generate
  QR (`qrcode.react` dari `setup_url`) + kode pendek + countdown expire —
  untuk setup & reset.
- [ ] **T8.4 — Link Telegram** (tombol → deep-link bot, status linked/unlink).

## Fase 9 — PWA & deploy

- [ ] **T9.1 — PWA polish**: manifest (nama, ikon, standalone), SW app-shell
  precache saja (`NetworkOnly` untuk `/api/` & media); uji install di
  Android/chromebook.
- [ ] **T9.2 — Nginx + DNS + env prod**
  Server block `ruangcerita.ihfazh.com` (static + `/api/` proxy + lokasi
  `internal` media); DNS; `DJANGO_ALLOWED_HOSTS` + env Telegram; webhook bot
  didaftarkan.
- [ ] **T9.3 — `deploy-diary.sh`**: build Vite → rsync `dist/` → server; gating
  `tsc --noEmit` + vitest.
- [ ] **T9.4 — Smoke test prod**
  Journey nyata end-to-end: wali buat akun anak → QR/kode → anak set password →
  tulis puisi + komik → wali baca (receipt) + komentar + Telegram masuk →
  anak balas. Ceklist manual didokumentasikan di folder spec ini.

---

## Catatan lintas fase

- Fase 1–5 murni backend — selesaikan & hijaukan sebelum menyentuh fase 6.
- Setiap fase backend diakhiri: `pytest` penuh hijau (termasuk suite lama).
- Bila pola kesalahan berulang 3× dalam satu sesi → tulis learning
  (`docs/learnings/`), sesuai aturan repo.
