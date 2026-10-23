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
`versi_benar` (opsional, disarankan) = teks setelah kata kembarnya diganti; dibuka setelah
misi selesai dan dipakai Kartu Pamer.

Gunting dan Kembar juga bisa memakai `contoh`, `bantuan_memudar`, dan `suara`
(lihat "Contoh dari Oren dan bantuan memudar" di bawah).

**`perasaan`** — Kamera: pilih perasaan + klik bukti (spec 075 K1)
```json
{"jenis": "perasaan", "tahap": "bersama", "bantuan_memudar": true,
 "contoh": [{"sorot": [{"cari": "Bahunya turun"}], "pikir": "Bahunya turun. Badannya lemas."},
            {"pilih": "sedih", "pikir": "Aku pilih sedih."},
            {"pikir": "Sekarang giliranmu."}],
 "soal": [
   {"teks": "Oren pulang dari taman. Bahunya turun. Dia menendang kerikil pelan-pelan.",
    "pilihan": ["senang", "sedih", "kaget"], "jawaban": "sedih",
    "bukti": [{"cari": "Bahunya turun"}, {"cari": "menendang kerikil pelan-pelan"}],
    "alasan": "Bahu turun dan menendang pelan-pelan. Itu tanda sedih."},
   {"teks": "...", "pilihan": ["..."], "jawaban": "...", "bukti": [...], "alasan": "..."}
 ]}
```
- Tiap `soal`: anak membaca `teks` (apa yang dilakukan tokoh, tanpa kata perasaan), memilih
  satu dari `pilihan` (2–4, `jawaban` wajib salah satunya), lalu mengklik kata di setiap
  `bukti` (ditulis seperti `cari` di `klik`, boleh `ke`). Satu klik pada kata mana pun di dalam
  satu bukti menemukan bukti itu; soal selesai bila semua bukti ditemukan. Kata di luar bukti
  dihitung meleset, jadi jangan menaruh petunjuk perasaan di luar `bukti`.
- Soal dikerjakan berurutan dan dinilai server per jawaban (`POST misi/<id>/perasaan/`
  dengan `{"soal", "perasaan"}` lalu `{"soal", "token"}`). `jawaban`, `bukti`, `alasan` satu
  soal baru dikirim setelah soal itu selesai.
- `contoh` (opsional): Oren mengerjakan **soal pertama** sambil berpikir keras. `sorot` dicari di
  teks soal pertama; `pilih` (opsional) = perasaan yang dipilih Oren di langkah itu, wajib sama
  dengan `jawaban` soal pertama. Soal pertama lalu dikirim lengkap dan tidak dinilai, jadi
  dengan `contoh` butuh minimal 2 soal. Label tahapnya "Contoh dari Oren".
- `bantuan_memudar: true` (setiap soal wajib punya `alasan`): soal anak ke-1 → semua kata bukti
  disorot (perasaannya tetap ditebak sendiri), ke-2 → kalimat bukti yang belum ditemukan,
  sesudahnya → tanpa bantuan. `alasan` selalu tampil setelah satu soal selesai.
- Hasil misi: `benar` = soal yang perasaannya tepat pada pilihan pertama, `total` = soal anak
  (tanpa soal Oren). Misi ini tidak masuk Kartu Pamer "sebelum/sesudah" (tidak ada teks yang
  dibetulkan).

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

## Panduan bahasa untuk anak (spec 075 K5)

Semua kalimat yang dibaca anak (judul, petunjuk, `kenapa`, `langkah`, gelembung Oren, alasan, ujian)
harus bisa dipahami anak **8 tahun** tanpa bantuan. Course dipakai anak 8 tahun ke atas, jadi jangan
menulis umur tertentu (misalnya "umur 10 tahun") di isi course.

- Kalimat pendek: sekitar 12 kata, paling banyak 15.
- Satu gagasan per kalimat. Pecah kalimat yang memakai "dan … lalu … sehingga".
- Kata sehari-hari. Hindari istilah sekolah tinggi ("repetisi", "sudut pandang"); pakai nama alat
  ("kata kembar", "Kamera").
- Sapa dengan "kamu". Sebut langkah berikutnya dengan kata kerja: "Klik", "Baca", "Tekan".
- Contoh jawaban ditulis seperti tulisan anak, bukan tulisan orang dewasa.
- Catatan untuk orang tua (`petunjuk_ortu`) boleh lebih panjang, tapi mulai dengan "Tujuannya: …"
  dan tulis sebagai "kalau dia bertanya, …", bukan sebagai tugas wajib (anak belajar mandiri).

## Contoh dari Oren dan bantuan memudar (spec 075 K1)

Untuk misi `klik` (Fase A: Modul 1; Modul 5 juga memakai `celah: true`). Misi `perasaan`
(Kamera) punya `contoh` dan `bantuan_memudar` versinya sendiri, lihat di atas:

```json
{"jenis": "klik", "tahap": "bersama", "suara": true, "bantuan_memudar": true,
 "contoh": [
   {"sorot": [{"cari": "deras sekali sekali."}], "pikir": "Aku baca keras-keras, ya."},
   {"sorot": [{"cari": "sekali sekali"}], "pikir": "Eh, lidahku tersandung di sini!"},
   {"pikir": "Sekarang giliranmu."}
 ],
 "kesalahan": [{"cari": "sekali sekali", "alasan": "Kata \"sekali\" ada dua. Satu saja cukup."}]}
```

- `contoh`: langkah demonstrasi berurutan. `pikir` (wajib) = gelembung pikiran Oren yang
  berpikir keras. `sorot` (opsional) = teks yang disorot, ditulis seperti `cari` di
  `kesalahan` (boleh `ke`); saat impor diubah menjadi indeks token. Teks yang tidak ada
  menggagalkan impor. Anak menekan **Lanjut** per langkah, lalu mengerjakan sisanya sendiri.
  Misi klik yang punya `contoh` tampil dengan label tahap "Contoh dari Oren" (nilai `tahap`
  tetap, jadi syarat stiker tidak berubah). Sorotan contoh terlihat oleh anak, jadi jangan
  menyorot kesalahan yang mau dicari sendiri.
- `bantuan_memudar: true`: setiap `kesalahan` wajib punya `alasan` (satu-dua kalimat pendek).
  Server memilih kesalahan pertama (urutan `kesalahan`) yang belum ditemukan: bila belum ada
  yang ditemukan, letak tokennya dan `alasan`-nya dikirim; setelah satu ditemukan, hanya
  kalimatnya; setelah dua, tidak ada bantuan. `alasan` tidak pernah dikirim selain lewat
  bantuan itu.
- Label "Contoh dari Oren" berlaku untuk misi `klik`, `gunting`, dan `kembar` yang punya `contoh`.

### Gunting (Fase B)

```json
{"jenis": "gunting", "tahap": "bersama", "suara": true, "bantuan_memudar": true,
 "contoh": [
   {"sorot": [{"cari": "rumah dan melompati"}], "pikir": "Di sini ada kata \"dan\"."},
   {"sorot": [{"cari": "rumah dan", "spasi": true}], "pikir": "Aku potong di sini."},
   {"pikir": "Sekarang giliranmu!"}
 ],
 "potong": [{"cari": "rumah dan melompati", "alasan": "Kalimatnya terlalu panjang."},
            {"cari": "besar dan dia"}]}
```

- `sorot` boleh memakai `"spasi": true`: hanya spasi di dalam `cari` yang disorot, tampil
  sebagai garis potong Oren (✂). Pola tanpa spasi menggagalkan impor.
- `bantuan_memudar: true`: `potong` pertama wajib punya `alasan` (yang lain boleh). Bantuan
  dihitung server dari garis potong anak saat itu (`POST misi/<id>/bantuan/` dengan
  `{"potong": [..]}`, tidak menilai dan tidak menyimpan apa pun): potongan pertama belum kena →
  spasinya ditunjukkan + `alasan`; sudah kena → hanya bagian kalimat (±3 kata di kiri-kanan)
  potongan kedua; keduanya kena → tidak ada bantuan. Potongan ketiga dan seterusnya tidak pernah
  diperiksa lewat bantuan, jadi tidak bisa ditebak. Penilaian tetap lewat Periksa.

### Detektor Kembar (Fase B)

```json
{"jenis": "kembar", "tahap": "bersama", "bantuan_memudar": true,
 "contoh": [{"sorot": [{"cari": "terus"}, {"cari": "Terus"}], "pikir": "Kata ini muncul lagi."}],
 "alasan": "Kata \"terus\" muncul tiga kali. Klik salah satunya.",
 "kata": ["terus", "oren"], "versi_benar": "..."}
```

Kembar hanya punya satu sasaran, jadi bantuannya memudar antarmisi, mengikuti `tahap`:
- tahap `bersama` + `bantuan_memudar` → semua kemunculan `kata` pertama disorot + `alasan`
  (wajib, string). Pakai di misi Contoh dari Oren.
- tahap lain + `bantuan_memudar` → hanya hitungannya ("Ada kata yang muncul 4 kali."), tanpa
  letak. Pakai di misi tahap `petunjuk`.
- tanpa `bantuan_memudar` (misi `mandiri`) → tidak ada bantuan.
Bantuan tidak dikirim lagi setelah misi selesai. `alasan`, `kata`, `versi_benar` tetap rahasia
sampai selesai.

### Suara

- `suara: true`: tampilkan tombol 🔊 yang membacakan teks dengan suara perangkat (bahasa
  Indonesia), dan pilihan "Dengarkan dulu, lalu teksnya muncul". Tanpa suara Indonesia di
  perangkat, tombol disembunyikan dan teks langsung tampil.
