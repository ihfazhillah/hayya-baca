# 075 · Belajar mandiri, pamer hasil, dan jelajah (Penerbit Rumah)

Status: disetujui pemilik (2026-10-23), menunggu persetujuan plan.
Melanjutkan: `specs/074-penerbit-rumah/`.

## Masalah

Misi "Bersama Ayah" (misi 1 tiap modul) menuntut orang tua duduk mendampingi setiap modul.
Itu terlalu menguras waktu, dan tahap "bersama" di layar sebenarnya tidak bersama: Ayah tidak punya
naskah, anak bisa menyelesaikannya tanpa Ayah, dan sebagian kegiatan (kata pengganti, "apa yang kamu
lihat") tidak punya tempat di layar.

## Arah baru (keputusan pemilik)

Interaksi dibalik. Anak belajar sendiri dari course, lalu **menunjukkan hasilnya** dan
**menceritakan apa yang dia pelajari**. Orang tua menyediakan course dan arahan, membantu bila anak
bertanya, dan menonton hasilnya. Bagian yang bisa mandiri dibuat mandiri. Anak diberi rasa **jelajah**.

## Kebutuhan

### K1. Contoh dari Oren (pengganti misi "Bersama Ayah")
- Misi 1 tiap modul menjadi contoh terpandu: aplikasi memperagakan alat langkah demi langkah dengan
  "gelembung pikiran" Oren (berpikir keras); anak menekan **Lanjut** per langkah, lalu mengerjakan
  bagian akhirnya sendiri.
- Di dalam misi latihan, bantuan memudar: kesalahan pertama ditunjukkan dan dijelaskan, kedua diberi
  petunjuk letak, sisanya dicari sendiri.
- Pengeras Suara dan Gunting: tombol 🔊 membacakan teks dengan suara tablet (Web Speech API, bahasa
  Indonesia), teks boleh disembunyikan dulu supaya telinga yang bekerja. Tanpa suara di perangkat →
  teks langsung tampil, misi tetap bisa diselesaikan.
- Kamera: anak membaca deskripsi gerakan lalu memilih perasaannya, kemudian mengklik kata yang
  membuatnya tahu. "Tebak gaya" bersama Ayah menjadi bonus.
- Semua isi contoh adalah data course (JSON), bukan kode per modul.

### K2. Tanya Ayah atau Ummah
- Di setiap misi ada tombol "Aku mau tanya Ayah atau Ummah". Anak menulis satu kalimat pertanyaan,
  lalu boleh lanjut.
- Pertanyaan tampil di Pojok Orang Tua (dasbor: jumlah pertanyaan terbuka) dengan konteks
  modul/misi; orang tua menekan **Sudah dijawab** (jawaban lisan, catatan opsional).
- Catatan orang tua di halaman misi berubah fungsi: "kalau dia bertanya, ini yang bisa kamu jawab".

### K3. Kartu Pamer (penutup setiap modul)
- Setelah misi utama modul selesai, anak menyusun Kartu Pamer:
  hasil terbaik (otomatis: sebelum/sesudah teks Si Ceroboh yang dia betulkan di modul itu),
  "Yang aku pelajari" (satu kalimat, wajib), rekaman suara penjelasan (opsional, tetap di tablet).
- Orang tua melihatnya di tablet bersama anak atau dari HP di Pojok Orang Tua, memberi reaksi
  (emoji atau satu kalimat), dan boleh memberi stiker. Reaksi muncul di Beranda anak.
- Kartu Pamer tidak mengunci modul berikutnya.

### K4. Jelajah
- **Ruang Latihan alat**: setelah Perunggu, tiap alat punya kumpulan teks ekstra yang bisa dimainkan
  bebas (memakai bank latihan yang ada). Tombol "Latih alat ini" membuka latihan alat itu saja.
  Hasilnya dihitung sebagai "teks baru" untuk Perak seperti latihan biasa.
- **Misi Jelajah**: misi bonus menjadi "pilih 1 dari 3 tantangan" (data course).
- **Buat soal untuk Ayah**: anak menulis teks Si Ceroboh sendiri dan menandai kesalahan yang dia
  sengaja; orang tua/kakak mengerjakannya di aplikasi dan dinilai. Terbuka setelah Perak alat itu
  (sesuai roadmap "Mengajarkan orang lain").
- **Alat Bebas**: anak menempel/mengetik paragraf apa saja dan memakai stabilo alat yang sudah
  terbuka. Tidak dinilai, tidak disimpan sebagai naskah.

### K5. Usia fleksibel, bahasa minimal untuk 8 tahun
- Prompt AI tidak lagi menulis "umur 10 tahun": memakai umur dari profil anak (`Child.age`) bila ada,
  selain itu "penulis anak usia SD".
- Panduan isi (`course/schema.md`): kalimat untuk anak harus bisa dipahami anak 8 tahun
  (kalimat pendek, ±12 kata; kata sehari-hari; satu gagasan per kalimat). Isi Modul 1–5 yang baru
  ditulis mengikuti panduan ini.

## Perubahan dari roadmap 074 (disetujui pemilik)
- Arti stiker Perunggu: "bisa dengan dibimbing" (sebelumnya "bisa bersama orang tua"). Tetap
  diberikan setelah misi 1 dan 2.
- Peran orang tua: dari pendamping sesi menjadi penonton hasil dan penjawab pertanyaan. Pemeriksaan
  lembar cetak dan stempel revisi tidak berubah.

## Di luar cakupan
- Modul 6–16 mengikuti pola ini setelah pemilik meninjau isinya (fase terpisah).
- Tidak ada AI baru; suara memakai suara bawaan perangkat.
- Rekaman suara tidak pernah diunggah.

## Kasus tepi
- Perangkat tanpa suara Indonesia / tanpa speechSynthesis → tombol 🔊 disembunyikan, teks tampil.
- Mode simulasi orang tua: pertanyaan dan Kartu Pamer milik profil simulasi, tidak tercampur dengan
  milik anak.
- Anak mengirim pertanyaan kosong atau sangat panjang → ditolak (maks. 300 karakter).
- Modul tanpa teks Si Ceroboh (Modul 6–16) → Kartu Pamer tanpa "sebelum/sesudah", hanya kalimat.
- Buat soal untuk Ayah: kesalahan yang ditandai anak harus bisa diklik (validasi sama dengan impor).
- Re-impor course tidak menghapus pertanyaan, Kartu Pamer, atau soal buatan anak.
