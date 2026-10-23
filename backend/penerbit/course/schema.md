# Format isi course Penerbit Rumah

`python manage.py impor_course penerbit/course/musim-1` membaca folder satu musim:

- `musim.json` — musim, alat, pangkat
- `modul-NN.json` — satu file per modul (termasuk lembar, ujian, misi)
- `latihan.json` — bank kalimat Latihan Harian (opsional)

Impor bersifat upsert: dijalankan ulang memperbarui baris yang sudah ada
(kunci: `Musim.nomor`, `Alat.kode`, `Pangkat.kode`, `Modul.nomor`,
`Misi(modul, urutan)`, `Lembar.kode`, `KalimatLatihan.kode`). Semua kunci jawaban
diperiksa saat impor; satu kesalahan menggagalkan seluruh impor.

## musim.json

```json
{
  "musim": {"nomor": 1, "nama": "...", "genre": "...", "deskripsi": "..."},
  "alat": [{
    "kode": "pengeras", "nama": "Pengeras Suara", "emoji": "🔊",
    "pertanyaan": "Apakah lidahku tersandung?", "cara_pakai": "...",
    "contoh_sebelum": "...", "contoh_sesudah": "...",
    "warna": "--color-actor-1", "pola_cetak": "gelombang", "urutan": 1, "modul_belajar": 1,
    "syarat": {"perunggu": {...}, "perak": {...}, "emas": {...}},
    "syarat_teks": {"perunggu": "...", "perak": "...", "emas": "..."}
  }],
  "pangkat": [{"kode": "magang", "nama": "Penulis Magang", "urutan": 1,
               "syarat": {"jenis": "perunggu_semua"}, "syarat_teks": "...", "hak_istimewa": "..."}]
}
```

`pola_cetak`: `gelombang` | `putus` | `lingkaran` | `tebal` | `titik`.

### Jenis syarat stiker

| jenis | parameter | arti |
|---|---|---|
| `misi_tahap_selesai` | `tahap: [..]` | semua misi modul alat ini dengan tahap tersebut sudah selesai |
| `skor_beruntun` | `min_rasio`, `kali`, `tanpa_petunjuk` | `kali` hasil terakhir di teks baru (misi `mandiri` + Latihan Harian alat ini) semuanya mencapai `min_rasio` (ditemukan / jumlah kesalahan) |
| `jejak_maks` | `angka`, `maks`, `cerita` | angka Jejak (`kalimat_terpanjang`, `kata_kembar_jumlah`, ...) ≤ `maks` di `cerita` Draf Nol terakhir berturut-turut |
| `pemeriksa` | – | diberikan Ayah atau Ummah |

### Jenis syarat pangkat

`perunggu_semua` (semua alat yang sudah dibuka punya Perunggu), `buku_terbit` + `jumlah`.

## modul-NN.json

```json
{
  "nomor": 1, "musim": 1, "level": 1, "judul": "Pengeras Suara", "alat": "pengeras",
  "emoji": "🔊", "tujuan": "...", "kenapa": "...",
  "langkah": ["...", "..."], "resep": ["..."], "mengapa": "...",
  "kamus": [{"istilah": "...", "arti": "..."}],
  "tahap_mentor": "tanpa|contoh|isian|mandiri", "lapis": "", "kartu_prompt": "",
  "petunjuk_lihat": "...",
  "ujian": [{"soal": "...", "a": "...", "b": "...", "jawaban": "a|b", "alasan": "..."}],
  "bertanya": {"a": "...", "b": "...", "jawaban": "b", "bagian": [1, 2, 3], "penjelasan": "..."},
  "lembar": [{"kode": "M4-3", "judul": "...", "petunjuk": "...", "soal": "...", "baris_tulis": 6,
              "pertanyaan_bantu": "...", "cek_sendiri": ["..."], "kriteria": "...",
              "contoh_jawaban": "...", "saran_stiker": "..."}],
  "misi": [ ... ]
}
```

### Misi

Semua misi: `urutan`, `judul`, `tahap` (`bersama|petunjuk|mandiri|dunia_nyata|bonus`),
`jenis`, `petunjuk` (teks untuk anak), opsional `petunjuk_ortu`.

**`klik`** — temukan kesalahan
```json
{"jenis": "klik", "teks": "...", "celah": false, "jumlah": 3,
 "kesalahan": [{"cari": "di di"}, {"cari": "nanti", "ke": 2},
               {"pilihan": [{"cari": "karena"}, {"cari": "karena", "ke": 2}]}],
 "versi_benar": "..."}
```
- `cari` cocok dengan kemunculan ke-`ke` (bawaan 1) yang sejajar batas token.
  Mengklik token mana pun di dalamnya dihitung menemukan kesalahan itu.
- `pilihan`: salah satu dari beberapa tempat dihitung benar (kunci ganda).
- `|` di dalam `cari` = celah (spasi yang hilang): `".|cacing"`, `"jahat|"`.
  Celah di tepi pola (`"jahat|"`) hanya bisa diklik sebagai celah; celah di tengah
  (`".|cacing"`) juga menerima klik pada tanda baca di dalamnya.
- `celah: true` menampilkan celah antar token sebagai area klik (Kaca Pembesar).
- `jumlah` (opsional) dicek terhadap banyaknya `kesalahan`.

**`gunting`** — potong kalimat di spasi
```json
{"jenis": "gunting", "teks": "...", "potong": [{"cari": "rumah dan melompati"}],
 "boleh": [{"cari": "rumah dan bersembunyi"}], "versi_benar": "..."}
```
Setiap `potong` wajib ditemukan: mengklik spasi mana pun di dalam rentang `cari`
dihitung. Potongan di `boleh` tidak wajib dan tidak dianggap salah.

**`kembar`** — Detektor Kembar
```json
{"jenis": "kembar", "teks": "...", "kata": ["lalu"], "pengganti": ["tiba-tiba", "..."]}
```
Misi selesai saat anak memilih salah satu `kata` (huruf besar/kecil diabaikan).

**`cetak`** — `{"jenis": "cetak", "lembar": "M4-3"}`

**`log`** — `{"jenis": "log", "pertanyaan": "..."}`

**`tandai`** — tandai selesai sendiri; opsional `teks` untuk ditampilkan, dan opsional
`tautan` (path halaman situs, mis. `"/naskah/baru/"`) yang dibuka tombol misi. Misi
Level 2 dan 3 yang dikerjakan di Ruang Penulis memakai `tandai` + `tautan`.

## latihan.json

```json
{"kalimat": [
  {"kode": "pengeras-01", "alat": "pengeras", "jenis": "klik", "teks": "...",
   "kesalahan": [...], "versi_benar": "..."},
  {"kode": "gunting-01", "alat": "gunting", "jenis": "gunting", "teks": "...", "potong": [...]},
  {"kode": "kembar-01", "alat": "kembar", "jenis": "kembar", "teks": "...", "kata": ["..."]}
]}
```
Satu kalimat (atau dua-tiga kalimat pendek), satu alat. Untuk Kamera: `klik` dengan
kesalahan = kalimat yang "bilang perasaan".
