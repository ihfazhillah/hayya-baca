# 075 · Plan

Setiap fase: test use-case yang gagal dulu → implementasi → suite hijau → commit → deploy → pemilik
mencoba lewat "Lihat sebagai anak". Fase berikutnya menunggu persetujuan.

## Fase A · Modul 1 sebagai percontohan
1. Data course: misi bisa punya `contoh` (langkah demonstrasi: sorotan token + gelembung pikiran) dan
   `bantuan_memudar: true`. Validasi di impor (token yang disorot harus ada).
2. Komponen `ContohOren` (langkah + Lanjut) dan bantuan memudar di `TeksKlik`
   (kesalahan ke-1 ditunjukkan, ke-2 diberi petunjuk letak, sisanya mandiri) — penilaian tetap di server;
   server mengirim petunjuk per tingkat tanpa membuka kunci yang belum perlu.
3. Tombol 🔊 (`speechSynthesis`, `lang=id-ID`) + "sembunyikan teks sampai selesai didengar".
4. Model `Pertanyaan` (profil, misi/modul, teks, dibuat, dijawab_oleh, dijawab_pada, catatan).
   API penulis: buat + daftar milik sendiri. API pemeriksa: daftar terbuka, tandai dijawab.
   UI: tombol di halaman misi; daftar di Pojok Orang Tua + angka di dasbor.
5. Model `KartuPamer` (profil, modul, pelajaran, dibuat, reaksi, reaksi_oleh). Sebelum/sesudah dihitung
   dari misi klik/gunting/kembar modul itu yang selesai. API penulis: buat/ubah; pemeriksa: daftar, beri
   reaksi (+ opsional stiker via jalur yang sudah ada). UI: kartu di akhir halaman modul; tampilan
   pemeriksa; reaksi di Beranda.
6. Prompt AI: umur dari `Child.age`, fallback "penulis anak usia SD".
7. Panduan bahasa 8 tahun di `course/schema.md`; tulis ulang isi Modul 1 yang terdampak.

## Fase B · Modul 2–5
Isi `contoh` per modul; Gunting & Kembar memakai bantuan memudar versi masing-masing; Kamera memakai
jenis misi baru "pilih perasaan + klik bukti" (data course); "Tebak gaya" pindah ke bonus.

## Fase C · Jelajah
1. Ruang Latihan alat: endpoint latihan per alat (bank `KalimatLatihan`), tombol "Latih alat ini".
2. Misi Jelajah: misi bonus dengan `pilihan` (3 tantangan), anak memilih satu.
3. Buat soal untuk Ayah: model `SoalBuatan` (profil, alat, teks, kesalahan) dengan validasi tokenizer
   yang sama; halaman mengerjakan untuk pemeriksa/tamu keluarga; hasil ditunjukkan ke anak.
4. Alat Bebas: halaman editor stabilo tanpa simpan.

## Fase D · Modul 6–16
Setelah tinjauan isi oleh pemilik: misi bersama → contoh/Tanya Ayah, Kartu Pamer di setiap modul.

## Risiko
- Suara tablet bahasa Indonesia tidak selalu tersedia → fallback wajib (lihat spec).
- Bantuan memudar tidak boleh membocorkan kunci: server hanya mengirim petunjuk untuk kesalahan yang
  memang sedang dibantu.
- Penambahan model baru → migrasi; data simulasi tetap terpisah lewat profil simulasi.
