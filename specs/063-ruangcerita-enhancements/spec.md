# Spec 063 — Peningkatan Ruang Cerita

**Status:** Draft — menunggu approval
**Tanggal:** 2026-07-28
**Produk:** Ruang Cerita (lihat [Spec 060](../060-ruang-cerita/spec.md), [061](../061-family-login/spec.md), [062](../062-jadwal-harian/spec.md))
**Menambah:** Sekumpulan perbaikan UX + fitur kecil hasil pakai sehari-hari.

## 1. Konteks

Setelah Ruang Cerita dipakai (diary + jadwal), muncul 8 permintaan perbaikan
dari penggunaan nyata. Semua kecil–menengah dan berdiri sendiri; digabung dalam
satu spec agar terlacak dan dirilis sekali.

## 2. Ruang lingkup fitur

| # | Fitur | Peran | Sifat |
|---|---|---|---|
| F1 | Komentar bisa multi-baris (newline) | anak + ortu | FE |
| F2 | Toggle lihat/sembunyikan password | semua | FE |
| F3+F4 | Anak reset password **sendiri** dengan **scan QR** dari ortu | anak | FE (backend sudah ada) |
| F5 | Anak bisa mengubah post yang **sudah terbit** | anak | FE + verifikasi BE |
| F6 | Filter feed ortu berdasarkan **tipe** (termasuk curhat selesai/belum) | ortu | BE + FE |
| F7 | **Tandai selesai** curhat → **tersembunyi** dari feed default | ortu | BE + FE + migrasi |
| F8 | Toggle "**perangkat orang tua**" → sesi persist, tak login tiap refresh | ortu | FE |

## 3. Keputusan desain

Diputuskan bersama pengguna (2026-07-28):

| # | Keputusan | Catatan |
|---|---|---|
| D1 | Komentar: **Enter = baris baru**, kirim lewat tombol. | Cegah terkirim tak sengaja; ramah anak. Simpan sebagai beberapa node `paragraph` (whitelist ProseMirror sudah mendukung). |
| D2 | Reset password anak: **ortu tetap generate** kode+QR (anak lupa password = terkunci, tak bisa buat sendiri). "Sendiri" = anak yang **scan & set** password baru dalam app, tanpa ortu mengetik apa pun. | Reuse endpoint `child-setup` (setup = reset). Tanpa backend baru. |
| D3 | Scan QR pakai `BarcodeDetector` native (tanpa dependency); **fallback** ketik kode manual (alur `/setup` yang sudah ada). | PWA Android didukung; iOS/Safari fallback ke ketik kode. |
| D4 | F5: edit post terbit **tidak** mengirim ulang notifikasi Telegram & **tidak** mengubah `published_at`. Konten ter-update, `updated_at` bergerak. | Hindari spam notifikasi tiap koreksi. |
| D5 | F7: curhat yang ditandai selesai **hilang dari feed default**; bisa dilihat via filter "Selesai". Yang menandai = **orang tua**. Hanya `type=curhat` yang bisa di-resolve. | Anak tetap melihat post-nya sendiri di timeline (tak terpengaruh resolve). |
| D6 | F6: filter tipe di **feed orang tua**. Untuk `curhat`, filter memuat dimensi **Belum selesai / Selesai** (menyatu dengan F7). | Timeline anak di luar scope filter untuk v1. |
| D7 | F8: **toggle eksplisit** "perangkat orang tua". ON → token ortu di localStorage, refresh tak minta login, **idle-lock nonaktif**. Sesi anak tetap ephemeral. `logout` / 401 tetap membersihkan. | Trade-off keamanan dipilih sadar oleh pengguna untuk perangkat pribadi ortu. |

## 4. Detail per fitur

### F1 — Komentar multi-baris
`Composer` (input satu baris, Enter=kirim) → `<textarea>` auto-grow, Enter=baris
baru, tombol "Kirim". `plainDoc(text)` memecah `\n` menjadi beberapa `paragraph`.
`RenderDoc` sudah render multi-paragraph.

### F2 — Toggle password
Komponen `PasswordInput` (ikon mata) menggantikan input password di Lobby &
SetupPage. Tanpa backend.

### F3+F4 — Reset password anak via scan QR
- Ortu: alur "Buat kode kata sandi" + QR di **Kelola Anak** sudah ada (QR
  meng-encode `/setup?code=…`). Perjelas label sebagai **"Reset kata sandi"**.
- Anak: di prompt password Lobby tambah **"Lupa kata sandi? Scan QR"** → buka
  scanner kamera in-app → baca URL → ekstrak `code` → ke `/setup?code=…`
  (prefilled) → set password baru → masuk. Reuse `childSetup`.

### F5 — Edit post terbit
Tombol "Ubah" di detail sudah mengarah ke Editor untuk post terbit. Verifikasi:
autosave (`updatePost` PATCH) jalan untuk status `published`; tidak re-notify;
`published_at` tetap. Editor tampilkan konteks "post sudah terbit" (bukan tombol
"Terbitkan" lagi, cukup "Selesai"). Guardian melihat konten terbaru di feed.

### F6 — Filter feed by type
- `FeedView`: param `?type=<slug>`. Untuk curhat, `?resolved=1` melihat yang
  selesai (lihat F7).
- `Feed.tsx`: baris chip tipe (dari `postTypes`) + chip khusus curhat
  "Belum selesai / Selesai". Digabung dengan chip anak yang sudah ada.

### F7 — Resolve curhat
- `Post.resolved_at` (nullable). Migrasi.
- `POST/DELETE /api/diary/posts/<id>/resolve/` (guardian only; hanya `curhat`).
- `FeedView` default `exclude(resolved_at__isnull=False)`; `?resolved=1` →
  hanya resolved.
- Serializer expose `resolved_at` + `is_resolved`.
- UI ortu: tombol "Tandai selesai" pada curhat di feed/detail.

### F8 — Perangkat orang tua (sesi persist)
- `sessionStore`: flag `trusted` (localStorage). ON → simpan `active` guardian
  (token+me); saat construct restore guardian langsung (skip lobby); idle-lock
  nonaktif. Anak tetap ephemeral. `logout`/`lock`(401) membersihkan.
- UI: toggle di halaman pengaturan ortu.

## 5. Privasi & keamanan

- F3/F4: kode reset tetap one-time & kedaluwarsa (mekanisme `PasswordSetupToken`
  existing). Scanner hanya membaca kode; endpoint memvalidasi.
- F7: resolve = aksi orang tua (permission `IsGuardianAccount`), divalidasi
  kepemilikan post (child punya ChildAccess parent = requester).
- F8: token guardian di localStorage hanya saat toggle ON — risiko diterima
  pengguna untuk perangkat pribadi. Anak tak pernah dipersist.

## 6. Di luar scope (v1)

- Ganti password anak dari **dalam sesi** dengan password lama (change-password) —
  reset via QR sudah cukup.
- Filter tipe di timeline anak.
- Edit/threading komentar kaya (rich) — F1 cukup plain multi-baris.
- Notifikasi saat curhat di-resolve.

## 7. Kriteria selesai

- F1: komentar 2 baris tersimpan & ter-render benar.
- F2: password bisa di-toggle terlihat/tersembunyi di Lobby & Setup.
- F3/F4: anak scan QR dari ortu → set password baru → masuk (fallback ketik kode).
- F5: anak mengedit post terbit; konten ter-update; tak ada notifikasi ulang.
- F6: ortu memfilter feed per tipe; curhat bisa disaring selesai/belum.
- F7: curhat yang di-resolve hilang dari feed default, muncul di filter "Selesai".
- F8: dengan toggle ON, refresh tidak meminta login ulang untuk ortu.
- Suite hijau: pytest + `npx tsc` + vitest.
