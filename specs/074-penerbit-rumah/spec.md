# Spec 074 — Penerbit Rumah (course menulis dan merevisi cerita untuk anak 10 tahun)

**Status:** Draft — menunggu approval spec
**Tanggal:** 2026-10-23
**Produk:** Aplikasi web terpisah `penerbit-web/` + backend app `backend/penerbit/`
**Pola:** Sama seperti Tahsin (Spec 072) dan English (Spec 064): SPA Vite + React,
di-serve nginx di `penerbit.ihfazh.com`, `/api/` di-proxy ke gunicorn Hayya Baca
yang sama (auth DRF token yang sama, PostgreSQL yang sama).

**Sumber kebenaran isi dan UI** (spec ini tidak menyalin ulang isinya):
- Roadmap Course Penerbit Rumah — https://claude.ai/artifact/UEr7FZqDKY243TruHA5kBg
  (isi course: alat, level, 16 modul, teks Si Ceroboh + kunci, stiker, poin, pangkat, kartu prompt)
- Rancangan Situs Penerbit Rumah — https://claude.ai/artifact/AMjynXiHB9H37ihnHCWPfY
  (peran, izin, design system, peta situs, halaman per halaman, komponen, editor, lembar cetak, model data, API)
- Mock-up Penerbit Rumah — https://claude.ai/artifact/Mbt9LaysxfBEYJkKaeJsTN (23 layar)

Spec ini mencatat **penyesuaian** rancangan ke arsitektur repo ini, ruang lingkup,
dan keputusan yang belum tertulis di dokumen di atas.

## 1. Konteks

Anak 10 tahun, perfeksionis, belajar dua kemampuan: menulis dari nol dan merevisi.
Course 3 level (~10 minggu) dengan 5 alat editor (Pengeras Suara, Gunting,
Detektor Kembar, Kamera, Kaca Pembesar). Ujungnya buku pertama yang 100% kalimatnya
sendiri. Situs adalah versi interaktif course tersebut, tampilannya memakai design
system course GDevelop kakaknya.

**Lingkup:** semua fitur di Rancangan Situs dibangun sampai lengkap sebelum dipakai
anak (bukan rilis bertahap per level).

## 2. Penyesuaian arsitektur (Rancangan Situs → repo ini)

| Rancangan Situs | Spec ini |
|---|---|
| Proyek Django sendiri + SQLite | Django app `backend/penerbit/` di project yang ada, PostgreSQL bersama |
| Template Django | SPA `penerbit-web/` (Vite + React + react-router), struktur disalin dari `tahsin-web` |
| `penerbit.local` di jaringan rumah | `penerbit.ihfazh.com`, tanpa pendaftaran publik |
| Session login 30 hari | DRF Token di `localStorage['penerbit.token']` (tidak kedaluwarsa, tablet tetap login) |
| Grup Django `penulis` / `pemeriksa` / `editor_tamu` | Lihat §3 (pakai `accounts.Child` + `ChildAccess`) |
| CSRF token di fetch | Header `Authorization: Token` seperti app lain |
| Quill dari CDN | Quill 2 lewat npm (alasan "tanpa build" tidak berlaku lagi) |
| `shared.css` / `shared.js` disalin | `shared.css` disalin utuh ke `penerbit-web/src/styles/`; perilaku `shared.js` (checklist, quiz, tab, salin) ditulis ulang sebagai komponen React karena progres wajib ke server, bukan `localStorage` |
| Cadangan salinan file SQLite | Ikut cadangan PostgreSQL server; `manage.py ekspor_naskah` tetap dibuat |

Sumber `shared.css`: https://ihfazhillah.github.io/gdevelop-endless-runner/course/shared.css
(semua token dan kelas yang disebut Rancangan Situs sudah dicek ada).

## 3. Aktor dan identitas

| Peran (dokumen) | Identitas di repo | Cara dikenali di `GET /api/penerbit/me/` |
|---|---|---|
| **Penulis** (anak) | Akun anak `Child.user` (login lewat `child-login` yang sudah ada) + `ProfilPenulis` (OneToOne `Child`) | `is_child_account(user)` dan punya `ProfilPenulis` |
| **Pemeriksa** (Ayah, Ummah) | `User` dengan `ChildAccess(role=parent)` ke Child penulis | punya ≥1 Child ber-`ProfilPenulis` lewat `ChildAccess` parent |
| **Editor Tamu** (misalnya kakak) | `User` biasa tanpa akses Child; hanya lewat `BagiNaskah` | punya ≥1 `BagiNaskah` |
| **Admin** | superuser, `/admin/` Django | — |

Satu User bisa memiliki lebih dari satu peran (misalnya Ayah juga Editor Tamu untuk
naskah lain); `me` mengembalikan daftar peran, frontend mendaratkan ke area utama:
Penulis → `/`, Pemeriksa → `/ortu/`, Editor Tamu saja → `/ulasan/`.

Kepemilikan data: semua data progres FK ke `ProfilPenulis` (bukan ke `User`), supaya
Pemeriksa bisa mengakses lewat `ChildAccess`. App ini hanya mengimpor dari `accounts`.

## 4. Kebutuhan fungsional

Semua halaman, URL, komponen, dan perilaku mengikuti bagian **Peta situs**,
**Halaman per halaman**, **Komponen interaktif**, **Editor tulisan**, **Jawaban
terbuka**, dan **Prompt** di Rancangan Situs. Route SPA memakai URL yang sama
(`/modul/<n>/misi/<k>/`, `/ortu/lembar/<id>/`, dst.); API di bawah `/api/penerbit/`.

### Backend (`backend/penerbit/`, prefix `/api/penerbit/`)

1. **Model isi course**: Alat, Modul, Misi, SoalUjian, KalimatLatihan, Lembar,
   SoalBertanya (kolom sesuai Rancangan Situs §Model data).
2. **`manage.py impor_course <dir>`**: membaca JSON, upsert berdasarkan kode/nomor,
   idempoten. File JSON di `backend/penerbit/course/`.
3. **Model progres**: ProfilPenulis, HasilMisi, HasilLatihan, JadwalUlang, Stiker,
   PemeriksaanLembar, Ide, Naskah, Versi, Jejak, Stempel, KartuUlasan, BagiNaskah,
   Prompt, Poin, Hadiah, Penukaran.
4. **Endpoint** sesuai tabel API Rancangan Situs, ditambah endpoint baca (GET) untuk
   tiap halaman dan endpoint Pemeriksa di `/api/penerbit/ortu/…`.
5. **Penilaian di server**: klien hanya mengirim jawaban (posisi klik, posisi potong,
   pilihan). Skor yang dikirim klien diabaikan.
6. **Mesin hadiah** (dijalankan setiap ada hasil baru):
   - Poin per tabel Poin di Roadmap; `Poin` adalah ledger (total = jumlah baris), tidak pernah berkurang kecuali penukaran yang disetujui.
   - Perunggu otomatis saat misi 1 dan 2 suatu alat selesai.
   - Perak otomatis untuk syarat yang bisa dihitung dari HasilMisi/HasilLatihan.
   - Emas otomatis hanya untuk **Gunting** dan **Detektor Kembar** (dari Jejak); Emas alat lain diberikan Pemeriksa (lihat §6).
   - Pangkat dihitung dari stiker Perunggu (Penulis Magang) dan jumlah buku terbit.
7. **Jadwal ulang**: alat yang Perunggu-nya didapat dijadwalkan +1 hari, +3 hari,
   +1 minggu, +2 minggu.
8. **Naskah**: Versi immutable setelah disimpan; Versi 1 memicu hitung Jejak
   (`penerbit/jejak.py`) dan mengunci Laci 48 jam (waktu server).
9. **Izin**: akses lintas penulis mengembalikan **404**; Pemeriksa tidak bisa
   mengubah teks naskah; Terbitkan hanya bila 5 stempel lengkap; Editor Tamu hanya
   membaca versi yang dibagikan.
10. **`manage.py ekspor_naskah`**: semua naskah ke file teks.

### Frontend (`penerbit-web/`)

1. Semua halaman area Penulis, Pemeriksa, dan Editor Tamu di Peta situs.
2. Komponen: Klik Kesalahan (termasuk tanda baca dan spasi untuk Kaca Pembesar),
   Gunting, Detektor Kembar, Ujian A/B, Latihan Bertanya, kotak prompt 3 tahap +
   refleksi, tombol salin, timer.
3. Editor Quill dengan 4 mode (Draf Nol, Stabilo, Revisi, Baca), stabilo per alat
   sebagai format inline, sorotan sistem vs anak, status "sudah diperbaiki",
   simpan otomatis 10 detik, antrean di `localStorage` saat offline.
4. Halaman cetak (`/cetak/<kode>/`, cetak per modul, cetak versi dengan pola
   hitam putih, cetak buku A5) dengan `@media print`.
5. Aturan tampilan: tidak ada merah di area Penulis, target sentuh ≥44px,
   `prefers-reduced-motion`, nyaman di tablet tegak 768px.

### Isi course

JSON untuk 16 modul, semua misi, ujian, lembar, kalimat Latihan Harian, dan
Latihan Bertanya. Modul 1–9 diambil dari Roadmap; isi yang belum ada di dokumen
(§6) disusun dan direview pemilik sebelum diimpor.

## 5. Di luar scope

- Ekspor ke Jaring (disebut di halaman Terbitkan, tapi formatnya belum didefinisikan).
- Musim 2–4 dan alat barunya (Telinga, Pengait, Jam); model Alat sudah mendukung.
- Unggah foto lembar, kecuali kalau mudah lewat media terlindungi yang sudah ada.
- PWA/offline penuh; hanya antrean simpan naskah yang offline.
- Integrasi Gemini selain tombol salin dan tautan.

## 6. Keputusan terbuka (perlu jawaban sebelum plan)

1. **Isi yang belum tertulis di Roadmap.** Belum ada: teks dan kunci misi Modul
   10–16 di luar tabel, isi semua lembar cetak selain M4-3, bank kalimat Latihan
   Harian, soal Latihan Bertanya Modul 1–9, dan teks Kenapa/Resep/Mengapa/Kamus untuk
   Modul 6–16. Usulan: Claude menyusun draf, pemilik mereview per modul.
2. **Kunci ganda.** Modul 1: "nanti" muncul dua kali di kalimat terakhir. Usulan: kunci
   bisa berupa grup posisi, dan salah satu anggota grup yang diklik dihitung benar.
3. **Daftar kata umum** untuk Detektor Kembar dan Jejak (yang tidak dihitung).
   Usulan awal: dan, yang, di, ke, itu, ini, dia, aku, akan, sudah, tidak, dengan, untuk, dari.
4. **Emas yang tidak bisa dihitung mesin** (Pengeras Suara, Kamera, Kaca Pembesar):
   Pemeriksa yang memberikan, dengan tampilan kemajuan sebagai bantuan.
5. **"Berani Hapus" (10 poin)**: diberikan Pemeriksa secara manual dari halaman naskah.
6. **Membuat akun Editor Tamu**: Pemeriksa mengetik username User yang sudah ada,
   atau membuatkan akun baru?
7. **Akun Penulis**: memakai akun anak yang sudah ada di Ruang Cerita (kalau ada),
   atau akun baru khusus Penerbit Rumah?

## 7. Kriteria selesai

- pytest `backend/penerbit/tests.py` hijau, mencakup: penilaian server, aturan
  stiker/poin/pangkat, jadwal ulang, Laci, Versi immutable, angka Jejak contoh
  "Sandal Jepit" (170 / 24 / lalu 4), izin + 404 lintas penulis, dan validasi semua
  kunci jawaban di JSON course terhadap teksnya.
- vitest `penerbit-web` hijau untuk komponen interaktif dan mode editor.
- Satu test perjalanan penuh: penulis dari Modul 1 sampai Terbit, dengan Pemeriksa
  memeriksa lembar, memberi stempel, dan menerbitkan.
- Setiap halaman dicocokkan dengan layar mock-up yang sesuai.
- Uji manual di tablet anak: cetak lembar, salin prompt ke Gemini, akses yang harus
  ditolak, spellcheck tablet mati di editor.
- Deploy lewat `deploy-penerbit.sh` (gate pytest + build frontend).
