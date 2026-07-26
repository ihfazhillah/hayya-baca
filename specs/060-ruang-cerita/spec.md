# Spec 060 — Ruang Cerita

**Status:** Draft — menunggu approval
**Tanggal:** 2026-07-26
**Produk:** PWA diary anak, terpisah penuh dari Hayya Baca, backend Django yang sama.

## 1. Visi

Ruang Cerita adalah "jembatan rahasia" anak → orang tua: tempat anak menulis
(puisi, pantun, cerpen, komik bergambar, curhat bebas) yang **pasti dibaca**
walinya. Rahasia dari dunia — terutama dari saudara — tapi terbuka ke wali.
Anak menulis *kepada* orang tuanya; orang tua hadir lewat komentar, reaksi,
dan tanda "sudah dibaca".

- Nama produk: **Ruang Cerita**
- Domain: `ruangcerita.ihfazh.com`
- Target device: mobile, tablet, chromebook — **semuanya shared device**,
  bukan milik pribadi siapa pun.
- Bukan bagian dari branding Hayya Baca; hanya berbagi backend & data `Child`.

## 2. Pengguna & peran

| Peran | Sumber akun | Kemampuan |
|---|---|---|
| **Wali** (parent) | Akun Hayya Baca existing (`ChildAccess` role `parent`, maks 2 per anak) | Baca semua post publish anaknya, komentar, reaksi; admin akun diary anak (buat akun, set username, generate QR/kode setup & reset password) |
| **Anak** | Django `User` baru, OneToOne ke `Child` existing | Tulis/edit/hapus karyanya sendiri, balas komentar wali, reaksi; set password sendiri |
| **Teacher** (`ChildAccess` role `teacher`) | — | **Tidak punya akses apa pun** ke Ruang Cerita |

Aturan inti:

- Semua wali (role `parent`) **setara**, termasuk untuk aksi admin. `created_by`
  di `Child` tetap sebagai pemilik record, tanpa hak istimewa tambahan.
- Anak hanya melihat karyanya sendiri. Saudara tidak pernah bisa melihat
  karya saudaranya, dalam bentuk apa pun (post, draft, komentar, notifikasi).
- Akun anak tidak pernah punya `ChildAccess` — endpoint Hayya Baca existing
  diberi guard (permission class `IsParent` / `IsChild`) agar akun anak tidak
  dianggap wali dan sebaliknya.

## 3. Autentikasi & sesi

### 3.1 Akun anak

- Anak = Django `User` sungguhan (reuse TokenAuthentication, hashing, admin).
- Username dipilih wali saat membuat akun diary, unik global; backend memberi
  saran alternatif saat bentrok.
- Password dibuat oleh **anak sendiri** lewat sesi setup (lihat 3.3).
- Kebijakan password anak: **min. 6 karakter, bebas bentuk** (boleh angka
  semua, boleh kata sederhana). Kompensasi: **lockout progresif** per username
  (misal mulai setelah 5 kali gagal). Akun wali tetap memakai validator
  standar Django.

### 3.2 Login harian anak

- Username + password, di device mana pun.
- Quick-pick: device menyimpan **hanya** daftar username + avatar yang pernah
  login di device itu (bukan token/sesi), untuk mempercepat login anak.

### 3.3 Sesi setup / reset password (QR + kode)

- Wali men-generate dari akunnya: backend membuat **token sekali-pakai,
  umur ±15 menit**, kemampuan tunggal "set password untuk anak X".
- Layar wali menampilkan **QR dan kode pendek 6–8 karakter** (isi QR = kode
  itu juga). Anak scan QR (tablet/HP) **atau** ketik kode (chromebook).
- Mekanisme yang sama dipakai untuk **setup awal dan reset** password.
- Setelah dipakai (atau kedaluwarsa) token hangus.

### 3.4 Sesi di shared device

- **Tutup tab = sesi mati.** Token tidak disimpan persisten; wajib login ulang.
- Auto-lock saat idle (±10 menit) → minta password lagi (username sudah
  ter-quick-pick).
- Tidak ada konten diary yang menetap di storage device (lihat 7. Offline).

## 4. Konten

### 4.1 Jenis post

- Setiap post punya **satu jenis, wajib, dipilih di awal** ("Aku mau nulis…"):
  puisi, pantun, cerpen, komik bergambar, curhat bebas.
- Daftar jenis dikelola di backend (bisa ditambah tanpa rilis frontend).
- Jenis menentukan bentuk editor (teks vs panel komik).
- **Judul opsional** di semua jenis.

### 4.2 Editor teks (puisi/pantun/cerpen/curhat)

- **TipTap** (ProseMirror), rich text ringan: **bold, italic, warna teks**,
  emoji. Toolbar besar & ramah anak.
- Konten disimpan sebagai **ProseMirror JSON**; backend memvalidasi terhadap
  **whitelist node/mark** (paragraph, text, bold, italic, textColor).
  Tidak ada HTML mentah di mana pun.
- Line break/bait terjaga (penting untuk puisi & pantun).

### 4.3 Komik bergambar

- Post komik = **deret 1–N panel berurutan**; panel = gambar + teks opsional.
- Sumber gambar v1: **upload/foto** (kamera tablet-HP, file picker chromebook).
- Model data panel **netral terhadap asal gambar** — canvas menggambar
  in-app bisa ditambah nanti tanpa migrasi.
- Konsekuensi: backend mulai menyimpan **media file user** (konfigurasi
  media storage + serving via nginx; resize/kompresi server-side).

### 4.4 Draft & publish

- Hanya **draft** yang privat (wali tidak bisa melihat draft).
- Post yang **dipublish selalu terlihat semua wali** anak itu. Tidak ada
  opsi "sembunyikan dari wali".
- Draft **auto-save ke server** (debounced, tiap beberapa detik) — bukan ke
  storage lokal. Draft muncul kembali di device mana pun anak login.
- Koneksi putus saat menulis: editor menahan perubahan di memori + retry;
  tulisan aman selama tab belum ditutup.

### 4.5 Kedaulatan anak (edit/hapus)

- Anak boleh **edit & hapus** post-nya kapan pun, termasuk setelah
  dikomentari (komentar ikut hilang dari UI bila post dihapus).
- Wali **tidak bisa** mengedit/menghapus karya anak.
- Komentar hanya bisa diedit/dihapus penulisnya sendiri.
- Semua penghapusan = **soft-delete** (hilang dari semua UI; recoverable
  via Django admin).

## 5. Interaksi

### 5.1 Komentar

- Satu **utas flat** (tanpa nested reply) per post.
- Dua arah: wali berkomentar, **anak pemilik post boleh membalas**, dst.
- Komentar memakai editor teks yang sama (subset ringan).

### 5.2 Reaksi

- Reaksi emoji cepat (set kecil, mis. ❤️ 👏 🌟) pada post — bisa diberikan
  wali maupun anak pemilik.

### 5.3 Read receipt

- Post menampilkan ke anak: **"✓ Dibaca Ayah · Dibaca Ibu"** (per wali).
- Tercatat saat wali membuka/membaca post di app.

## 6. Notifikasi

### 6.1 In-app (semua pengguna)

- Badge/penanda "ada yang baru": wali → post baru anak; anak → komentar/
  reaksi baru di karyanya.

### 6.2 Telegram (wali saja, v1)

- Wali me-link akunnya ke bot Telegram sekali (deep-link `/start <kode>`).
- Event: (a) anak publish post baru, (b) anak membalas komentar.
- Isi pesan: nama anak + jenis post + **judul (kalau ada) + excerpt singkat**.
  **Isi penuh tidak pernah dikirim** ke Telegram.
- Arsitektur kanal notifikasi dibuat extensible — kanal lain (Web Push, dsb.)
  menyusul di fase berikutnya.

## 7. Beranda & navigasi

- **Wali:** feed gabungan kronologis semua anaknya (avatar jelas), chip
  filter "Semua / per-anak" dengan **badge belum-dibaca** per anak.
- **Anak:** timeline karyanya sendiri (draft & publish), tombol besar
  "Aku mau nulis…" dengan 5 kartu jenis.

## 8. Non-goals (v1)

- ❌ Gamifikasi ekonomi: **tidak ada koin/bintang**; tidak menyentuh sistem
  rewards Hayya Baca. (Kalau nanti butuh pemantik kebiasaan → bentuk
  non-ekonomi, didiskusikan terpisah.)
- ❌ Offline-first: app **online-required**. Service worker hanya cache
  **app shell** (fast load + installable), tidak pernah data diary.
- ❌ Canvas menggambar in-app (pintu terbuka via model data panel).
- ❌ Visibility per post "hanya aku" (kalau perlu → fitur jurnal privat
  terpisah, nanti).
- ❌ Nested threading komentar.
- ❌ Web Push (menyusul, untuk wali).
- ❌ Akses teacher.
- ❌ Integrasi UI dengan app Hayya Baca RN (maksimal deep-link, nanti).

## 9. Arsitektur teknis

### 9.1 Frontend

- **React + Vite + TypeScript strict + Tailwind CSS + `vite-plugin-pwa`.**
- SPA login-gated, folder **`diary-web/`** di root repo ini (monorepo).
- Deploy: build statis → nginx serve di `ruangcerita.ihfazh.com`.

### 9.2 Backend

- Django app baru **`diary`** di project `backend/` yang sama.
- Perluasan kecil di **`accounts`**: user-anak (OneToOne `Child.user` atau
  model penghubung), token setup/reset, guard permission untuk endpoint lama.
- Auth: DRF TokenAuthentication existing.
- Media storage untuk gambar panel komik (server disk + nginx `/media/`).
- Telegram bot untuk notifikasi wali.

### 9.3 Data model (sketsa, finalisasi di plan.md)

- `Child.user` — OneToOne nullable ke `User` (akun diary anak).
- `PostType` — daftar jenis (slug, label, ikon, urutan) dikelola backend.
- `Post` — child, type, title (nullable), body (ProseMirror JSON, nullable
  untuk komik), status (draft/published), soft-delete, timestamps.
- `ComicPanel` — post, urutan, image, caption opsional.
- `Comment` — post, author (User: wali atau anak), body, soft-delete.
- `Reaction` — post, user, emoji (unique per user+post+emoji).
- `ReadReceipt` — post, wali, timestamp pertama dibaca.
- `PasswordSetupToken` — child, kode, expires, used.
- `TelegramLink` — user wali ↔ chat id.

## 10. Detail kecil (diputuskan saat desain/plan, kecuali user menyetir)

- Panjang excerpt notifikasi Telegram.
- Set emoji reaksi final.
- Batas ukuran file & jumlah panel komik; parameter resize server-side.
- Parameter lockout progresif & rate-limit endpoint login/setup.
- Durasi idle auto-lock persis.
- Skema saran username saat bentrok.

## 11. Riwayat keputusan

Semua keputusan di atas hasil interview 2026-07-26; setiap cabang dikunci
eksplisit oleh user (identitas anak = Django User; privasi = terbuka ke wali,
draft privat; wali = role parent saja, semua setara; login username+password;
sesi mati saat tutup tab; PWA tunggal untuk dua peran; komik = upload dulu;
jenis post tunggal wajib; rich text ringan via TipTap JSON; utas flat dua
arah + reaksi; soft-delete; in-app + Telegram ber-excerpt + read receipt;
password anak longgar + lockout; QR + kode; online-required; feed gabungan;
React+Vite; monorepo; nama Ruang Cerita; tanpa koin).
