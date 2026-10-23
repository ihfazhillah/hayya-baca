# Spec 076 fase 2: Modul 1–10, Boss 1–3, Bonus

Status: disetujui pemilik 2026-10-24 ("gas semuanya, pastikan contoh aslinya pas dengan search").
Tambahan dari pemilik: setiap bait (kunci, contoh, peragaan) diberi **makna** yang disesuaikan,
dan kata-katanya masuk ke **laci**.

## Yang sudah dibangun untuk fase ini (commit 4993054)

- Bahr baru di mesin: kamil, basith, thawil, wafir, mujtats, masing-masing dengan zihaf/'illah yang
  lazim dan diuji dengan bait model blueprint (`src/lib/timbang.test.ts`).
- `src/lib/qafiyah.ts`: rawiy, harakat rawiy, ridf; cek `muzdawij` dan `satu` qafiyah.
- Latihan `susun` untuk banyak bait (`jumlah`, `qafiyah`, `rancangan`), latihan `irama`
  (putar suku pendek/panjang), langkah peragaan `irama`.
- `makna` wajib di setiap contoh; `kunciMakna` di setiap bahr; `laci` per modul.
- Boss dan bonus diberi nomor: Boss 1 = 11, Boss 2 = 12, Boss 3 = 13, bonus ramal majzu' = 14,
  bonus mujtats = 15. Nama tampilannya lewat `label`.

## Panduan menulis isi modul (untuk penulis manusia maupun agen)

File: `nadzom-web/src/content/modul-NN.json` (NN dua digit: `modul-01.json`, `modul-11.json`).
Bentuk data: `nadzom-web/src/content/jenis.ts`. Contoh lengkap: `modul-00.json`.
Modul otomatis termuat (glob) dan ditest oleh `src/content/isi.test.ts`.

### Aturan sumber (wajib)

1. **Setiap bait Arab di `amtsilah`, `bahts`, `taqthi`, `irama` harus bait asli yang diverifikasi
   lewat pencarian web** (Shamela, al-Diwan aldiwan.net, Wikisource, adab.com, islamweb, kitab PDF).
   Bandingkan minimal dua sumber bila bisa. Tulis sumbernya di `sumber` (nama kitab/penyair, nomor
   bait bila ada).
2. Bait buatan (cetakan, draf pincang untuk debug loop, contoh revisi) boleh, tetapi `sumber`
   harus jujur: "Bait latihan, bukan kutipan."
3. Harakat lengkap. Kalau sumber tidak berharakat, beri harakat dengan hati-hati; mesin menolak
   kata tanpa harakat.
4. Lirik nasyid modern **tidak disalin**. Nasyid hanya ditautkan di `dengar` (URL YouTube yang sudah
   dicek ada, boleh dengan `?t=` menit). Bait klasik boleh dikutip.
5. Bait ditimbang oleh mesin di test isi. Kalau bait asli yang terverifikasi dicap patah, **jangan
   ubah baitnya agar lolos**. Catat sebagai temuan mesin (bait, sumber, pola yang diharapkan).

### Aturan bahasa

- Bahasa Indonesia sederhana untuk pelajar agama yang kuat nahwu-sharaf-tajwid tetapi belum belajar
  bayan, manthiq, atau 'arudh. Jembatani istilah baru ke nahwu/sharaf/tajwid.
- `makna`: terjemah yang disesuaikan, enak dibaca, menangkap maksud; bukan kata per kata.
- Hudhud (pemandu) berbicara sebagai teman, singkat, satu langkah satu gagasan. Tidak ada mata,
  wajah, atau candaan tentang ayat.
- Notasi bit: 1 = hidup, 0 = mati. Pola ditulis dari kiri (1010110).
- Tanpa em dash. Kalimat pendek.

### Alur setiap pelajaran (an-Nahwul Wadhih)

`amtsilah` (contoh) → `bahts` (peragaan langkah demi langkah oleh Hudhud, lalu giliran pengguna
menandai satu syathr) → `qaidah` → `tamarin` → `patokan` (target sesi yang bisa dicek dan
menghasilkan sesuatu). Satu pelajaran 20–30 menit; 2–3 pelajaran per modul.

### Laci

`laci` di modul: kata/frasa dari bait modul itu yang berguna untuk menyusun, dengan `arti`,
`laci` (`hasyw` | `wazan` | `qafiyah` | `umum`), `catatan` (pola sharaf, pasangan qafiyah),
`dari` (asal bait). 8–20 entri per modul. Harakat lengkap.

## Rencana per modul

| No | Modul | Bait model (verifikasi) | Pelajaran dan hands-on | Hasil |
|---|---|---|---|---|
| 1 | Telinga Rajaz | Alfiyah, rajaz Khandaq | Kunci dan irama (`irama`); nada Alfiyah sebagai alat periksa (mana yang pincang); revisi Bait #1 | Bait #1 v2 |
| 2 | Jebakan 'Ajam | Muqaddimah Alfiyah | Syaddah dan tanwin; hamzah washal dan huruf yang gugur; isyba' lalu susun | Bait #2 |
| 3 | Empat Wajah Rajaz | 'Imrithi | Khabn; thayy dan khabl; 'illah dharb (qath') lalu susun tanpa cetakan | Bait #3 |
| 4 | Bank Kata | Manzhumah Sirah (bila terverifikasi) atau nadzom rajaz klasik lain | Laci hasyw; laci wazan sharaf; laci qafiyah lalu revisi | Revisi #1–#3 |
| 5 | Muzdawij | Alfiyah, urjuzah Abu al-'Atahiyah (Dzat al-Amtsal) | Muzdawij; pasangan qafiyah; susun 5 bait (`qafiyah: muzdawij`) | 5 bait |
| 11 | Boss 1 | — | Susun 10 bait muzdawij mengikuti rancangan blueprint | 10 bait rajaz |
| 6 | Kamil | Nuniyah Ibnul Qayyim | Kunci kamil dan idhmar; jebakan dua harakat pendek; ganti satu kata (cetakan satu kotak) | 1 bait |
| 7 | Laci ـانِ | Nuniyah Ibnul Qayyim | Rawiy, majra, ridf; laci qafiyah ـانِ; susun 3 bait (`qafiyah: satu`) | 3 bait kamil |
| 8 | Basith | Nuniyah al-Busti | Kunci basith; dua nuniyah dibandingkan; susun | 1 bait basith |
| 12 | Boss 2 | — | Mu'aradhah: 5 bait kamil berqafiyah ـانِ | 5 bait |
| 9 | Thawil | Ta'lim al-Muta'allim | Kunci thawil; ganti satu kata (الْعِلْمَ → الْحِفْظَ); ganti "enam syarat" | 2 bait |
| 10 | Wafir | شَكَوْتُ إِلَى وَكِيعٍ | Kunci wafir dan 'ashb; susun | 1 bait |
| 13 | Boss 3 | — | 3 bait thawil atau wafir, nasihat thalabul ilmi | 3 bait |
| 14 | Bonus ramal majzu' | bait klasik ramal majzu' | Tiga jenis qafiyah; susun satu bagian | 4 bait |
| 15 | Bonus mujtats | syahid mujtats klasik | Kunci mujtats; susun | 4 bait |

## Selesai bila

- Semua modul di atas ada, test isi hijau, typecheck bersih.
- Agen reviewer 'arudh memeriksa ulang sumber dan harakat; agen reviewer tampilan memeriksa
  halaman baru (irama, susun banyak bait, laci).
- Deploy ke diwan.ihfazh.com.
