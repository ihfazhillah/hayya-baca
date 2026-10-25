# 077 · Plan

Setiap fase dimulai dengan test yang gagal dulu (alur.test.tsx atau isi.test.ts), lalu isi dan kode.
Setiap fase dideploy terpisah setelah pemilik setuju.

## Fase A · Jilid 1 (rajaz salim)

**Kode**
- `content/jenis.ts`:
  - `salim?: true` untuk tamrin `susun`, `cetakan`, `taqthi`, `pincang`.
  - `cocok?: string` di `KataBank`.
  - `tangga` boleh berupa butir dengan `calon: string[]` (3 calon, satu pincang).
- `components/Susun.tsx` dan `Cetakan`: dalam mode salim, potongan `berubah` dirender sebagai "belum dipelajari", dan patokan gagal.
- `lib/timbang.ts`: preferensi bacaan pilihan (isyba' opsional) yang membuat semua taf'ilah utuh, bila ada. Test dulu.
- `components/Laci.tsx`: saring menurut modul yang terbuka (urutan peta sampai modul ini) dan `bahr` tamrin. Tampilkan `cocok`.

**Isi**
- **M0 P1:** buang al-Buhturi. Ganti dengan syahid salim kedua atau bait latihan berlabel.
- **M0 P2:** cetakan rajaz salim, dengan 1 kotak lalu 2 kotak. Kotaknya frasa مُسْتَفْعِلُنْ dari laci. Bahts dan amtsilah diganti juga.
- **M0 P3:** pola mu'aradhah = bait «كَرِّرْ دُرُوسَ…». Ketentuannya:
  - Tangga: ganti satu kata (3 calon) → ganti satu taf'ilah → ganti syathr 1 → bait sendiri.
  - Bahts memperagakan mu'aradhah atas pola itu.
  - Qaidah zihaf dan 'illah dihapus dari M0.
  - Jalur "makna dulu" pindah ke Jilid 2.
- **M1:** contoh telinga dan Bait #1 v2 memakai bait utuh. Nama khabn, khabl, dan thayy dihapus; yang tersisa hanya "nada Alfiyah", sebagai alat periksa untuk bait salim.
- **M2:**
  - Jebakan 'ajam dilatih pada bait utuh, atau kitabahnya sudah diisikan bila baitnya berzihaf.
  - Laci hasyw dan laci qafiyah (dari M4 P1 dan P3) dibuka di sini.
  - Bait #2 disusun dengan laci, dalam mode salim.
- **Istilah:** rawiy didefinisikan di qaidah sebelum ditanyakan. Pilihan bahr di TaqthiBertahap dibatasi pada bahr yang sudah dipelajari.
- **rujukan/laci:** 12–20 kata ujung ـدَا dan ـلِ (huruf sebelum rawiy hidup), dan 15 frasa hasyw bertema belajar/doa yang masing-masing satu مُسْتَفْعِلُنْ utuh.

**Test**
- isi.test:
  - Setiap tamrin `salim` (pola, cetakan, taqthi) memiliki 0 taf'ilah berubah.
  - Setiap istilah di soal kenali Jilid 1 sudah muncul di qaidah pelajaran sebelumnya. Cukup daftar istilah kunci.
- alur.test:
  - Mode salim menolak bait berkhabn dengan pesan "belum dipelajari".
  - Laci M0 tidak menampilkan kata kamil.

## Fase B · Jilid 2

- **M3:** zihaf satu per sesi (khabn → thayy → khabl untuk dikenali → qath' bersama rawiy). Khandaq dan Alfiyah bait 1 dibedah di sini. Revisi Bait #1 dengan khabn.
- **M4:** teknik revisi (laci wazan, tangga perbaikan: buang → geser → ganti sewazan → ganti semakna).
- **M5:** muzdawij, lalu satu pelajaran **qafiyah satu di rajaz** (2–3 bait).
- **Kamil, basith, thawil, wafir:**
  - P1 salim dengan "bentuk baku" berlabel.
  - P2 satu zihaf.
  - P3 tangga bantuan (cetakan multi-kotak, `pola`, `tangga`).
  - Wafir mendapat P3: dua bait satu qafiyah.
- **Muraja'ah** di awal Babak 2 dan 3 (tebak bahr campuran, timbang ulang Diwan).

## Fase C · Boss dan jalan keluar

- **Boss 1:** dipecah menjadi bait 1–3, 4–6, 7–10, lalu revisi.
- **Boss 2:** kamil atau basith; qafiyah dipilih sendiri dari laci.
- **Boss 3:** tema saja.
- **Kosakata Boss:** setiap butir rancangan mendapat 4–6 kata berharakat.
- **Kartu tashih i'rab** di Susun sebelum tombol salin.
- **Ujian akhir** (modul baru): tema, bahr, dan qafiyah dipilih sendiri, 4–7 bait.
- **Halaman "Langkah berikutnya"** di Rujukan.

## Fase D · Jilid 3 (setelah Jilid 1–2 dipakai)

- Ramal majzu' dan mujtats dicabut status bonusnya.
- Bentuk majzu' (kamil, wafir dengan hazaj sebagai pembanding, basith mukhalla').
- Khafif dan mutaqarib, termasuk penambahan bahr di mesin dan test mesin.
- Darurah syi'riyyah dan 'uyub qafiyah.
- Tangga menebak bahr bait asing.
