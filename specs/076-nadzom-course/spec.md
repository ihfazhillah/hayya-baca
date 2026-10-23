# 076 · Course Nadzom & Syair untuk Orang 'Ajam

Status: draf revisi 2, menunggu persetujuan pemilik.
Blueprint isi: https://claude.ai/artifact/6njYwBmekyV5PRu492tvbo (Claude Docs, 2026-10-21).

## Masalah

Pemilik suka mendengar dan membaca syair, dan belajar ilmu dari nadzom (Alfiyah, 'Imrithi).
Tetapi ia belum bisa menyusun bait yang wazannya tidak pincang: telinga Indonesia menghitung
suku kata dan tekanan, sedangkan wazan Arab menghitung panjang-pendek. Blueprint sudah menyusun
kurikulumnya (3 babak, modul 0–10, 3 Boss, bonus). Yang belum ada: tempat menjalankannya.

## Keputusan pemilik

- Untuk diri sendiri, orang dewasa, belajar mandiri. Tidak ada guru, akun, peran, atau pemeriksa.
- Target: dasar-dasar menyusun dan keterampilan hands-on tercapai. "Seperti orang Arab" adalah
  arah latihan jangka panjang, bukan target course.
- Waktu: 2–3 jam per pekan (sesi 20–30 menit, 1–3 sesi per modul) → kira-kira 2–4 bulan.
- **Diwan tidak disimpan aplikasi.** Bait ditulis di mana saja (kertas, HP, Obsidian).
- Hosting: `nadzom.ihfazh.com` di server yang sama, situs statis. DNS diurus pemilik.
- Kode di repo ini (`nadzom-web/`) untuk sementara; boleh dipindah ke repo sendiri nanti.

## Hasil akhir dan bentuk sesi (keputusan pemilik)

- **Hasil akhir course:** pemilik bisa menyusun sendiri nadzom/syair pendek, minimal **4 bait**
  yang wazannya tidak pincang, tentang tema yang ia pilih.
- **Hands-on, bukan tontonan.** Setiap sesi (20–30 menit) punya:
  1. **Patokan praktik**: satu target yang jelas dan bisa dicek sendiri (mis. "taqthi' 2 bait model
     sampai cocok dengan kunci", "isi template rajaz dengan 2 kata sendiri, 0 taf'ilah patah").
  2. **Hasil**: sesuatu yang benar-benar dibuat dan bisa disalin ke Diwan (bait taqthi'an, bait
     template, bait sendiri, versi perbaikan).
  3. **Cek sendiri**: checker memberi tahu lulus/belum; tidak ada penilai lain.
- Materi penjelasan dan video hanya pengantar singkat sebelum praktik, bukan inti sesi.
- Satu modul = 1–3 sesi; tiap sesi ditulis sebagai kartu sesi (patokan, langkah, hasil) di JSON modul.

### Sumber belajar (kandidat, belum ditonton; dipilih saat menulis tiap modul)

| Sumber | Bahasa | Untuk |
|---|---|---|
| [KH Marzuqi Mustamar, Panduan Menyusun Syair Arab](https://www.youtube.com/watch?v=Y7pWQdsIsDA) | Indonesia | Menyusun syair, cocok dengan tujuan course |
| [Lil Jamik, Cara Mentaqthi' Bait Syiir](https://www.youtube.com/watch?v=o8jPrFeortE) | Indonesia | Langkah taqthi' |
| [Lil Jamik, Belajar mudah Ilmu Arudh (1 jam)](https://www.youtube.com/watch?v=AGXZ-sgr3i4) | Indonesia | Gambaran utuh |
| [Khalil Ibrahim, سلسلة تعلم العروض ١](https://www.youtube.com/watch?v=8n6xp89caZ4) | Arab | Kitabah 'arudhiyyah, seri |
| [Muhannad Halimah, تعلم العروض للمبتدئين ١](https://www.youtube.com/watch?v=pbIF4R449wg) | Arab | Huruf yang ditambah dalam kitabah 'arudhiyyah |
| [Abu Qudamah, التلخيصات الشافية درس 11: الرجز](https://abuqudamah.com/talkheesat_shafeyah_11) | Arab (tulisan) | Langkah taqthi' bertahap + latihan mandiri, seri 11 pelajaran |
| [Terjemah al-Mukhtashar asy-Syafi](https://archive.org/download/terjemah-mukhtashor-syafi-ilmu-arudh-qawafi-mktbhazzaen/Terjemah%20Mukhtashor%20Syafi%20(Ilmu%20'Arudh%20&%20Qawafi).pdf) | Indonesia | Rujukan kaidah |

## Kebutuhan

### K1. Peta course
- Halaman utama: 3 babak + bonus, daftar modul dan Boss, keluaran tiap modul (dari blueprint).
- Tandai modul selesai (checkbox manual). Disimpan di localStorage perangkat itu saja; hilang pun
  tidak masalah.

### K2. Halaman modul (satu template, isi dari JSON)
Urutan tetap mengikuti blueprint:
1. Analogi pembuka
2. Dengar: bait model (teks Arab berharakat, RTL) + tautan YouTube ke menitnya
3. Kunci bahr (teks + pola)
4. Langkah-langkah dengan centang
5. Mengapa ini bekerja
6. Ujian: pilihan ganda ("mana yang pincang?", "taf'ilah mana yang patah?"), umpan balik langsung
7. Misi mini: instruksi + checker tertanam

Isi modul adalah data (`content/modul-NN.json`), bukan kode per modul.

### K3. Checker wazan
- Masukan: teks Arab berharakat (utama) atau suku kata Latin (`ma-la-hal-ar-waa`), satu syathr per
  baris atau dipisah `|`. Checker menampilkan juga kitabah 'arudhiyyah-nya, supaya terlihat huruf
  mana yang dihitung.
- Keluaran: pola `–` (panjang) / `ب` (pendek) per suku kata, dipotong per taf'ilah, dicocokkan ke bahr
  sasaran. Tiap taf'ilah berstatus **utuh**, **zihaf yang dikenal** (dengan nama zihafnya), atau
  **patah**. Ringkasan: jumlah taf'ilah patah.
- Versi bertahap mengikuti blueprint: v1 (Modul 0: rajaz + ramal), v2 (Modul 3: zihaf rajaz),
  v3 (Babak 2–3: ketujuh bahr kunci).
- Juga tersedia sebagai halaman tersendiri (`/checker`) untuk dipakai di luar modul.
- Deterministik, tanpa AI. Diuji dengan bait-bait model dari blueprint.

### K4. Salin ke Diwan
- Tombol **Salin** di checker: menyalin bait + pola + jumlah patah sebagai Markdown, siap ditempel
  di Obsidian atau catatan lain. Aplikasi tidak menyimpan apa pun.

### K5. Rujukan yang berjalan sepanjang course
- Kunci bahr (7 kunci + pola), bank kata (laci hasyw, wazan sharaf, qafiyah), papan playlist +
  tangga menebak bahr: halaman rujukan statis dari JSON.

## Edge case checker (perlu disepakati sebelum plan)

| # | Kasus | Usulan perilaku |
|---|---|---|
| 1 | Suku kata terbuka/tertutup | CV = pendek; CVV dan CVC = panjang |
| 2 | Syaddah | Dua huruf: sukun lalu berharakat (`kar-rir`) |
| 3 | Tanwin | Nun sakinah di akhir kata (`ra-bun`) |
| 4 | Hamzah washal di tengah kalam | Tidak dibaca; huruf sebelumnya menyambung (`ma-ni-l-…` → `ma-nil-…`) |
| 5 | Alif lam syamsiyah | Lam lebur, huruf berikutnya bertasydid |
| 6 | Akhir syathr/bait | Harakat akhir dipanjangkan (isyba'): `-ma` → `-maa` |
| 7 | Alif khanjariyah tak tertulis (هذا، لكن، الله، الرحمن) | Daftar kata pengecualian kecil; dibaca panjang |
| 8 | Ha' dhamir setelah harakat (بِهِ، لَهُ) | Isyba' dalam wasl hanya bila diapit dua harakat; bisa dinyalakan/dimatikan |
| 9 | Mim jama' (عليهم) | Default sukun; harakat bila wazan menuntut → tampilkan dua kemungkinan |
| 10 | Teks Arab tanpa harakat lengkap | Ditolak dengan pesan "beri harakat atau pakai suku kata Latin" (tidak menebak) |
| 11 | Ya/waw sebagai diftong (بَيْت، يَوْم) | Sukun → menutup suku kata (CVC = panjang), bukan vokal panjang |
| 12 | Taf'ilah tidak utuh tapi cocok zihaf yang dikenal | "Berubah, dibahas di Modul 3", bukan patah |

## Keputusan pemilik (2026-10-23, lanjutan)

### Urutan: dari yang utuh, baru ke potongan-potongannya
- Taf'ilah dikenalkan dulu dalam bentuk **utuh** (salim), seperti belajar wazan sharaf dari
  bentuk asalnya sebelum i'lal dan ibdal. Perubahan (zihaf, 'illah) baru dibahas setelah telinga
  dan mata terbiasa dengan bentuk utuh.
- Bait model pertama Modul 0 harus rajaz yang **seluruh taf'ilahnya utuh**. Kandidat: syahid
  rajaz tam di kitab 'arudh, دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ / قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ
  (perlu dicek ulang dengan kitab sebelum dipakai). Rajaz Khandaq (*Nahnu alladzina*) tetap
  diperdengarkan, tetapi dibedah sebagai contoh utama di Modul 3.
- Checker v1 menilai terhadap bentuk utuh. Taf'ilah yang tidak utuh tapi cocok dengan zihaf yang
  dikenal **tidak** ditandai patah; ditandai "berubah, dibahas di Modul 3". Hanya yang tidak cocok
  dengan apa pun yang ditandai patah. Jadi bait Khandaq tidak dicap pincang, padahal sah.
- Tracer bullet tetap: setiap modul menghasilkan bait utuh, walaupun kasar.

### Fase pertama
Situs + checker v1 + Modul 0 lengkap, lalu deploy. Modul berikutnya menyusul satu per satu.

### Bahasa: untuk pelajar ilmu syar'i dan bahasa Arab
- Pembaca sudah lama belajar bahasa Arab (nahwu, sharaf, tajwid), tetapi belum belajar 'arudh,
  qawafi, bayan, atau manthiq. Course **tidak mengandaikan** bayan atau manthiq.
- Istilah 'arudh selalu dijembatani dengan ilmu yang sudah dikenal:

| Istilah 'arudh | Jembatan |
|---|---|
| Taf'ilah (مستفعلن) | Seperti mizan sharaf (فَعَلَ): timbangan, bukan kata |
| Bahr | Seperti bab dalam tashrif: satu pola yang diulang |
| Mutaharrik / sakin | Huruf berharakat / huruf sukun, sama seperti di nahwu |
| Kitabah 'arudhiyyah | Yang diucapkan ditulis, yang tidak diucapkan tidak ditulis; seperti membaca dengan tajwid |
| Zihaf | Seperti i'lal: bentuk asal berubah karena sebab yang diatur, tetap sah |
| Syathr, 'arudh, dharb | Paruh bait, taf'ilah akhir paruh pertama, taf'ilah akhir paruh kedua |

- Masukan utama checker adalah **teks Arab berharakat**. Suku kata Latin tetap ada sebagai jalan pintas.
- Penjelasan aturan taqthi' memakai istilah tajwid yang sudah dikenal: hamzah washal, lam syamsiyah
  (idgham), mad thabi'i, tanwin = nun sakinah, waqf.
- Kalimat pendek, langsung ke contoh, tidak bertele-tele. Istilah Arab ditulis dengan huruf Arab.

## Di luar cakupan

- Akun, sinkron, penyimpanan Diwan, grafik Diwan (Diwan ada di catatan pemilik).
- Audio rekaman sendiri, pengenalan suara, AI.
- Babak "jazalah/balaghah" (dicatat untuk nanti).
- Aplikasi RN Hayya Baca.
