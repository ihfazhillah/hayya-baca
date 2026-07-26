# Ceklist Test Manual — Ruang Cerita

Hal-hal yang **tidak** tercakup pytest/vitest dan butuh device/browser nyata.
Target device: HP, tablet, chromebook (semua shared device). URL produksi:
https://ruangcerita.ihfazh.com

## 1. Install PWA

- [ ] Android Chrome: muncul prompt "Add to Home screen", ikon tampil, buka
      sebagai standalone (tanpa address bar).
- [ ] Chromebook Chrome: bisa "Install Ruang Cerita", jalan di window sendiri.
- [ ] iOS Safari: "Add to Home Screen", judul & ikon benar.
- [ ] Ikon terlihat wajar (SVG). Jika buram/kotak putih di launcher → butuh
      ikon PNG raster (follow-up F3 di tasks.md).

## 2. Sesi di shared device (Spec §3.4)

- [ ] Login anak → **tutup tab** → buka lagi → harus login ulang (token tak persist).
- [ ] Diamkan idle **10 menit** → sesi terkunci otomatis, minta password lagi
      (username/avatar sudah terisi via quick-pick).
- [ ] Quick-pick: setelah beberapa anak login di device sama, chip nama+avatar
      muncul di layar login; pilih chip → tinggal isi password.
- [ ] Draft yang sedang diketik lalu koneksi putus sebentar → tulisan tidak
      hilang selama tab belum ditutup (autosave retry).

## 3. Setup/reset password anak (QR + kode)

- [ ] Wali (tab Orang Tua) → Kelola Anak → buat akun anak → muncul **QR + kode**
      + hitung mundur kedaluwarsa.
- [ ] Tablet: anak **scan QR** dengan kamera → terbuka `/setup?code=...` →
      set password → auto-login.
- [ ] Chromebook (kamera kurang): anak **ketik kode** di `/setup` → set password.
- [ ] Kode kedaluwarsa (>15 mnt) → ditolak; buat kode baru berhasil.
- [ ] "Buat kode baru" membatalkan kode lama (kode lama tak bisa dipakai).

## 4. Editor & konten

- [ ] Editor teks: bold/italic/warna/emoji jalan; puisi/pantun mempertahankan
      baris & bait; indikator "Tersimpan ✓" muncul setelah berhenti mengetik.
- [ ] Komik: **ambil foto dari kamera** (tablet/HP) + **pilih file** (chromebook);
      panel ter-resize (cepat dimuat), caption, urutkan (↑/↓), hapus panel.
- [ ] Gambar panel tampil di detail via `<img>` (signed URL / X-Accel-Redirect)
      tanpa error, dan **tidak** bisa diakses tanpa token/kadaluwarsa.
- [ ] Publish → muncul di feed wali. Edit setelah publish → berubah. Hapus →
      hilang dari semua tampilan (soft-delete).

## 5. Privasi antar-saudara

- [ ] Login sebagai anak A, catat URL sebuah post; login anak B di device sama →
      buka URL post A → **tidak** bisa (404), tidak muncul di timeline B.
- [ ] Draft anak **tidak** terlihat wali; hanya yang sudah publish.

## 6. Interaksi wali ↔ anak

- [ ] Wali komentar → anak lihat & bisa balas → wali lihat balasan.
- [ ] Reaksi emoji dua arah muncul dengan hitungan benar.
- [ ] Anak melihat "✓ Dibaca Ayah / Ibu" setelah wali membuka post.
- [ ] Badge belum-dibaca di chip filter wali bertambah saat anak posting,
      hilang setelah dibuka.

## 7. Multi-wali

- [ ] Dua wali (mis. ihfazh + maryam) sama-sama melihat feed & bisa komentar
      anak yang sama; keduanya bisa admin (buat/reset kode).
- [ ] Teacher (role `teacher`) **tidak** melihat diary sama sekali.

## 8. Telegram (setelah F2 diaktifkan)

- [ ] Wali → menu Telegram → "Hubungkan" → buka bot → `/start` → status
      "Terhubung".
- [ ] Anak publish → wali dapat pesan Telegram: nama + jenis + (judul) +
      excerpt, **tanpa** isi penuh.
- [ ] Anak balas komentar → wali dapat notifikasi balasan.
- [ ] Matikan/putuskan → tidak lagi dapat notifikasi.

## 9. Regresi Hayya Baca

- [ ] App Hayya Baca (RN) tetap login & sync normal (backend gunicorn dipakai
      bersama; migrasi bersifat additif).
