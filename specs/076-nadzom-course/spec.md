# 076 · Course Nadzom & Syair untuk Orang 'Ajam

Status: draf, menunggu persetujuan pemilik.
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
- Masukan: suku kata Latin (`ma-la-hal-ar-waa`) **atau** teks Arab berharakat, satu syathr per baris
  atau dipisah `|`.
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
| 12 | Model rajaz Modul 0 sudah memakai zihaf (*Nahnu alladzina*: ب – ب –) | Lihat pertanyaan terbuka 1 |

## Pertanyaan terbuka

1. Rajaz Khandaq di Modul 0 sudah memakai *khabn* (مُتَفْعِلُنْ). Kalau checker v1 hanya mengenal
   مستفعلن utuh, bait model itu sendiri akan ditandai patah. Usul: v1 sudah mengenal zihaf rajaz
   yang paling umum (khabn, thayy) sebagai "zihaf yang dikenal", dan Modul 3 menjelaskannya.
2. Isi materi tiap modul (analogi, langkah, ujian) belum ditulis di blueprint, hanya kerangkanya.
   Usul: modul ditulis bertahap mengikuti tracer bullet. Fase pertama = situs + checker v1 +
   Modul 0 lengkap, langsung di-deploy; modul berikutnya menyusul satu per satu.

## Di luar cakupan

- Akun, sinkron, penyimpanan Diwan, grafik Diwan (Diwan ada di catatan pemilik).
- Audio rekaman sendiri, pengenalan suara, AI.
- Babak "jazalah/balaghah" (dicatat untuk nanti).
- Aplikasi RN Hayya Baca.
