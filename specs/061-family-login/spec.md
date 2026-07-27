# Spec 061 — Login Keluarga (Family Lobby)

**Status:** Deployed 2026-07-27 (dengan revisi di bawah)
**Tanggal:** 2026-07-27
**Produk:** Ruang Cerita (lihat [Spec 060](../060-ruang-cerita/spec.md))
**Mengubah:** Alur autentikasi & sesi (Spec 060 §3)

## Revisi 2026-07-27 (post-deploy) — lobby-first

Setelah dipakai, keputusan D1/D5 diubah karena (a) unlock + tile "Orang Tua"
= login orang tua yang sama → double-password terasa ribet, dan (b) kalau
unlock langsung ke mode orang tua, perangkat "beristirahat" di mode orang tua →
anak bisa melihat diari saudaranya.

Keputusan final:

- **Tidak ada layar unlock terpisah.** **Lobby = layar utama & keadaan istirahat.**
  Login orang tua ada di **tile "Orang Tua"** (bukan layar sendiri). Pertama kali
  (belum ada cache) lobby hanya menampilkan tile "Orang Tua" (minta username +
  password); login ini sekaligus mengisi cache daftar anak.
- **Satu password per profil.** Tap "Orang Tua" → password orang tua (1×) → mode
  orang tua. Tap anak → password anak. Tak ada double-password.
- **Anak tak pernah lihat diari saudara:** keadaan istirahat = lobby (cuma nama);
  mode orang tua (semua anak terlihat) selalu di balik password.
- **Reload/relaunch → lobby** (menang atas "tetap login"): tidak ada token di
  storage (D4 tetap). Menyalakan lagi = tap profil + password. Idle → lobby.
- Konsekuensi: `unlock` dihapus, digabung ke `enterGuardian(username, me, token)`
  yang mengisi cache family **dan** masuk mode orang tua. `LoginPage` dihapus.

## 1. Konteks & masalah

Alur login sekarang (Spec 060 §3) menampilkan dua tab di halaman depan —
**Anak** dan **Orang Tua** — dan masing-masing login independen dengan
username + password. Anak yang login menyimpan roster **quick-pick** di
localStorage supaya bisa dipilih ulang.

Masalah yang dirasakan:

- Tidak ada satu titik masuk yang jelas. Anak harus tahu username-nya sendiri
  dan mengetiknya; roster quick-pick baru muncul setelah login pertama.
- Orang tua ingin **memegang kendali**: perangkat dibuka dulu oleh orang tua,
  baru anak-anak memilih profilnya — seperti profil di Netflix.

## 2. Visi

Perangkat keluarga dengan **satu lobby**:

1. **Orang tua membuka (unlock) dulu** dengan password-nya. Setelah itu daftar
   anak langsung tampil tanpa perlu mengetik username.
2. **Lobby** menampilkan tile tiap anak + satu tile **"Orang Tua"**.
3. Masuk ke sebuah **anak** → ketik **password anak itu**.
4. Masuk ke **mode orang tua** → ketik **password orang tua lagi**.
5. Tiap anak punya **password sendiri**; saudara tidak bisa membuka ruang
   saudaranya tanpa password.

Perangkat tetap **shared device** (Spec 060) — tak ada yang memilikinya
pribadi; keamanan bersandar pada password per-profil + idle-lock.

## 3. Keputusan desain

Diputuskan bersama pengguna (2026-07-27):

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Tile **"Orang Tua"** meminta **password lagi** untuk masuk mode orang tua. | Lobby bersifat netral (hanya daftar nama); membaca diari butuh otorisasi. |
| D2 | **Selalu orang tua dulu** — tidak ada login anak langsung. | Model perangkat keluarga + kontrol orang tua; lebih sederhana. |
| D3 | **Sesi keluarga tersimpan** — reload/relaunch kembali ke **lobby** tanpa login ulang orang tua. | Ganti profil mulus; tetap password per-profil. |
| D4 | **Tidak ada token tersimpan di storage** — hanya daftar anak (cache) yang disimpan. | Menyimpan token full-access orang tua di localStorage akan membuat gate password D1 tak berarti. Token cukup di memori, per-profil. |
| D5 | Saat pertama unlock: orang tua → **lobby** → tile Orang Tua → **password lagi**. (Bukan langsung masuk mode orang tua.) | Konsisten dengan D1. |

## 4. Model sesi & keamanan

Dua lapis, menggantikan `{token, me}` tunggal sekarang:

- **Family (disimpan di localStorage, TANPA token):**
  `{ guardianUsername, children: [{ id, name, avatar_color, username, has_diary_account }] }`.
  Ini yang membuat lobby bertahan saat refresh. Sensitivitasnya setara roster
  quick-pick sekarang (yang sudah menyimpan nama + username di localStorage).
- **Active profile (HANYA di memori, tidak pernah dipersistkan):** token hidup —
  entah token **anak** atau token **orang tua** — diperoleh **baru** tiap kali
  memasukkan password profil tsb. Hilang saat reload/relaunch.

Konsekuensi:

- **Reload/relaunch** → selalu mendarat di **lobby** (family cache), belum ada
  token; masuk profil apa pun perlu password lagi.
- **Anak** tidak pernah punya token tersimpan — aman untuk chromebook bersama.
- **Idle-lock** (10 menit, Spec 060 §3.4) → kembali ke **lobby**, family cache
  tetap. Melanjutkan = ketik password profil lagi.
- Gate password mode orang tua (D1) adalah gate **otorisasi nyata** (re-auth ke
  server), bukan sekadar UI, karena tidak ada token orang tua yang menganggur.

## 5. Alur & layar

1. **Unlock (halaman depan):** hanya login orang tua (username + password) →
   `POST /api/auth/login/` → token orang tua (memori sesaat) → `GET /me/`
   (guardian) → simpan **family cache** (username + children) → tampilkan
   **Lobby**. Token orang tua dari langkah ini **dibuang** (D4/D5).
2. **Lobby:** tile tiap anak dengan `has_diary_account = true` (avatar + nama) +
   tile **"Orang Tua"**. Anak tanpa akun tampil **disabled** dengan keterangan
   "Belum ada akun". Menekan tile membuka **prompt password**.
3. **Masuk anak:** `POST /api/auth/child-login/` dengan `username` anak (dari
   cache) + password → token anak (memori) → **ChildApp**.
4. **Masuk orang tua:** `POST /api/auth/login/` dengan `guardianUsername` (dari
   cache) + password → token orang tua (memori) → **GuardianApp**. Sekaligus
   **refresh** family cache dari `/me/`.
5. **Ganti profil:** tombol di header ChildApp & GuardianApp → buang token aktif
   → kembali ke **Lobby** (family cache utuh).
6. **Keluar:** hapus family cache + token aktif → halaman **Unlock**.
7. **Idle-lock / 401:** buang token aktif → **Lobby**.

## 6. Kontrak API

**Tidak ada perubahan backend.** Semua sudah tersedia:

| Kebutuhan | Endpoint existing |
|---|---|
| Unlock / masuk mode orang tua | `POST /api/auth/login/` (username, password) → `{token}` |
| Daftar anak (nama, avatar, username, has_diary_account) | `GET /api/diary/me/` (guardian) — sudah mengembalikan `children[]` |
| Masuk anak | `POST /api/auth/child-login/` (username, password) → `{token, child}` |

## 7. Dampak ke yang sudah ada

- **Halaman login** (Spec 060 §3): tab Anak/Orang Tua **dihapus**; jadi unlock
  orang tua saja.
- **Quick-pick roster** (`src/auth/quickpick.ts`): **tidak lagi dipakai** di alur
  login; digantikan family cache. (Modul boleh dihapus di tasks.)
- **Persist sesi orang tua** (fix #11, sessionStore localStorage): **digantikan**
  model family/active di spec ini.
- **Setup password anak** (`/setup?code=…`, QR): **tetap** sebagai jalur masuk
  langsung anak — dikecualikan dari D2 karena diinisiasi orang tua (menyerahkan
  kode). Setelah setup, anak masuk **ChildApp** langsung (perilaku sekarang).
- **LockScreen** existing: diganti oleh mekanisme lobby + prompt password.
- **ChildApp / GuardianApp** isi layar: **tidak berubah**, hanya ditambah tombol
  "Ganti profil" di header/nav.

## 8. Edge cases

- Orang tua tanpa anak berakun → lobby hanya tile "Orang Tua".
- Password salah (anak / orang tua) → error inline di prompt, tetap di lobby.
- Lockout login anak (429) → pesan "Terlalu banyak percobaan…".
- Cache anak basi (anak ditambah/di-rename setelah cache) → di-refresh saat
  masuk mode orang tua (dan tiap unlock).
- Dua orang tua satu anak → masing-masing unlock dengan akunnya sendiri; lobby
  menampilkan anak-anak sesuai `ChildAccess` parent-nya.
- Token aktif kedaluwarsa/401 → kembali ke lobby, minta password lagi.

## 9. Di luar scope

- Tidak mengubah backend / model data.
- Tidak menambah PIN/biometrik (hanya password existing).
- Tidak mengubah isi ChildApp/GuardianApp selain tombol "Ganti profil".
- Migrasi data: tidak ada (family cache dibangun saat unlock berikutnya;
  quick-pick lama diabaikan).

## 10. Kriteria selesai

- Halaman depan = unlock orang tua saja; tak ada tab anak.
- Setelah unlock, lobby menampilkan anak berakun + tile Orang Tua.
- Masuk anak butuh password anak; masuk orang tua butuh password orang tua.
- Reload → kembali ke lobby tanpa login ulang; masuk profil minta password lagi.
- Tidak ada token tersimpan di localStorage (hanya daftar anak).
- Idle-lock kembali ke lobby.
- Alur setup password anak via kode tetap berfungsi.
