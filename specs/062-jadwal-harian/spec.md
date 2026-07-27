# Spec 062 — Jadwal Harian Anak

**Status:** Draft — menunggu approval
**Tanggal:** 2026-07-27
**Produk:** Ruang Cerita (lihat [Spec 060](../060-ruang-cerita/spec.md))
**Menambah:** Ruang pribadi anak — dari "cerita" jadi "rencana + cerita"

## 1. Konteks & visi

Muncul dari permintaan seorang anak: *"Babah, ini bisa buat jadwal harian?"*

Ruang Cerita hari ini = ruang pribadi tiap anak untuk **mengekspresikan diri**
(nulis, gambar) yang didengar orang tua. Jadwal menambah sisi kedua:
**merencanakan hari**. Keduanya tetap **pribadi per anak** (saudara tak bisa
lihat) dan tetap jembatan ke orang tua (orang tua melihat & menyemangati).

Visi: Ruang Cerita tumbuh dari "diary anak→ortu" menjadi **pendamping pribadi
anak** — merencanakan hari *dan* menceritakannya, dengan orang tua tetap hadir.

## 2. Pengguna & peran

| Peran | Kemampuan atas jadwal |
|---|---|
| **Anak** (pemilik) | Membuat, mengubah, menghapus tugasnya sendiri; mencentang selesai. Jadwal ini **miliknya**. |
| **Orang tua** | Melihat jadwal + progres tiap anaknya; **menambah** tugas untuk anak (mis. "mengaji"). Tidak mencentang untuk anak. |
| **Saudara** | Tidak punya akses apa pun (isolasi sama seperti diary). |

## 3. Keputusan desain

Diputuskan bersama pengguna (2026-07-27):

| # | Keputusan | Catatan |
|---|---|---|
| D1 | Anak pemilik & penyusun utama; **orang tua juga bisa menambah** tugas. | Autonomi anak + struktur dari ortu. |
| D2 | Tiap tugas bisa **sekali (one-time)** ATAU **rutin berulang** — dua-duanya didukung dalam satu daftar. | Rutin default "tiap hari"; bisa pilih hari tertentu. |
| D3 | Waktu berbasis **bagian hari**: **pagi / siang / sore / malam** — bukan jam presisi. | Lebih ramah anak. |

## 4. Model konsep

- **Tugas (task)** milik seorang anak:
  - `judul` (mis. "Sholat Subuh", "Beresin mainan")
  - `bagian_hari`: pagi | siang | sore | malam (untuk urutan dalam sehari)
  - `jenis`: **rutin** (berulang) atau **sekali** (one-time)
    - rutin → berlaku hari-hari tertentu (default tiap hari)
    - sekali → berlaku satu tanggal spesifik
  - `dibuat_oleh`: anak atau orang tua (biar anak tahu mana titipan ortu)
  - `emoji`/ikon opsional
  - status arsip (tugas rutin yang sudah tak dipakai bisa di-nonaktifkan)
- **Penyelesaian (completion)**: centang per tugas per **tanggal**. Mencentang
  hari ini tidak mengubah hari kemarin (riwayat tetap).
- **Daftar hari ini** = tugas rutin yang berlaku untuk hari itu + tugas sekali
  bertanggal hari itu, dikelompokkan per bagian hari, dengan status centang.

## 5. Alur & layar

### Sisi anak (tab baru "Jadwal" di aplikasi anak)
- **Hari ini**: daftar tugas dikelompok pagi/siang/sore/malam, tiap tugas ada
  kotak centang. Tugas titipan orang tua ditandai halus (mis. ikon 👪).
- **Kelola**: tambah/ubah/hapus tugas (pilih judul, bagian hari, rutin/sekali,
  hari berulang atau tanggal).
- Rasa "berhasil": progres hari ini (mis. "3/5 selesai") + perayaan kecil saat
  semua selesai.

### Sisi orang tua
- Per anak: lihat **jadwal & progres hari ini** (mirip "sudah dibaca" di feed),
  dan **tambah tugas** untuk anak itu.

## 6. Reward — DITUNDA ke fase 2 (keputusan 2026-07-27)

v1 **tanpa reward**: fokus ke buat tugas + centang + progres "x/y selesai".
`Child` sudah punya field **coins/stars**, jadi bintang bisa ditambahkan nanti
tanpa mengubah data — fase 2, setelah alur inti mantap.

## 7. Privasi & isolasi

- Jadwal seorang anak **hanya** terlihat oleh anak itu dan orang tuanya
  (ChildAccess role parent). Saudara tak pernah melihat.
- Guard permission sama seperti endpoint diary existing (akun anak vs orang tua).

## 8. Di luar scope (v1)

- **Pengingat/notifikasi** (in-app atau Telegram) — fase berikutnya.
- **Jam presisi / alarm** — cukup bagian hari.
- **Offline check-off** — ikut model app sekarang (online-required); sync offline
  kalau perlu, nanti.
- **Berbagi jadwal antar anak / template global** — tidak.
- Keterkaitan otomatis jadwal ↔ diary ("ceritakan harimu") — ide bagus, tapi
  bukan v1.

## 9. Kriteria selesai (v1)

- Anak bisa membuat tugas (rutin/sekali, per bagian hari) dan mencentangnya.
- Orang tua bisa menambah tugas untuk anak & melihat progres hari ini.
- Riwayat centang tersimpan per tanggal.
- Saudara tidak bisa mengakses jadwal anak lain.
- v1 tanpa reward (bintang = fase 2).
