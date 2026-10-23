# Plan 074 — Penerbit Rumah

Acuan: `spec.md`, Rancangan Situs, Roadmap Course, Mock-up (link di spec).

## Struktur

```
backend/penerbit/                 app Django baru (INSTALLED_APPS + path("api/penerbit/", include("penerbit.urls")))
  models/course.py                Musim, Alat, Pangkat, Modul, Misi, SoalUjian, KalimatLatihan, Lembar, SoalBertanya
  models/progres.py               ProfilPenulis, Percobaan, HasilMisi, HasilLatihan, JadwalUlang, Stiker, Poin,
                                  PemeriksaanLembar, Hadiah, Penukaran, Prompt
  models/naskah.py                Ide, Naskah, DrafKerja, Versi, Jejak, Stempel, KartuUlasan, BagiNaskah
  peran.py                        resolve_peran(user) → {penulis: ProfilPenulis|None, pemeriksa_untuk: [ProfilPenulis], tamu: bool}
                                  + helper queryset profil_untuk(request, penulis_id) → 404 bila bukan miliknya
  teks.py                         tokenize(teks) → [Token(i, jenis kata|tanda|spasi, teks)]  ← satu-satunya tokenizer
  penilaian.py                    nilai_klik, nilai_gunting, nilai_kembar, nilai_ujian (per jenis misi)
  hadiah.py                       evaluasi(profil): poin, stiker (dari syarat data), pangkat — idempoten
  jadwal.py                       jadwal ulang + pilih kalimat Latihan Harian
  jejak.py                        lima angka dari teks polos
  kata_umum.py                    daftar kata umum (Detektor Kembar + Jejak)
  course/musim-1/*.json           isi course; course/schema.md menjelaskan format
  management/commands/impor_course.py, ekspor_naskah.py
  serializers/, views/ (penulis.py, ortu.py, tamu.py), urls.py, admin.py
  tests/                          test_peran, test_impor_course, test_isi_course, test_penilaian, test_hadiah,
                                  test_jadwal, test_jejak, test_naskah, test_ortu, test_tamu, test_musim_data,
                                  test_perjalanan (Modul 1 → Terbit)
penerbit-web/                     Vite + React 19 + TS + react-router 7 (skeleton dari tahsin-web, TANPA Tailwind)
  index.html                      Google Fonts (Bricolage Grotesque, DM Sans, JetBrains Mono)
  src/styles/shared.css           salinan utuh dari course GDevelop
  src/styles/menulis.css          komponen baru (Rancangan Situs §Komponen baru) memakai token shared.css
  src/styles/ortu.css             area Pemeriksa: 1100px, aksen --color-info, lebih padat
  src/styles/cetak.css            @media print
  src/api.ts, auth.tsx, me.tsx    token `penerbit.token`, request(), AuthProvider, peran dari /me/
  src/components/                 Nav, KlikKesalahan, Gunting, DetektorKembar, UjianAB, LatihanBertanya,
                                  KotakPrompt, TombolSalin, Timer, KartuAlat, SlotStiker, Stempel, Tab, Konfeti
  src/editor/                     Quill 2: modes.ts, stabilo.ts (format inline), sorotan.ts (carry + diperbaiki),
                                  antrean.ts (offline), Editor.tsx
  src/pages/penulis/, ortu/, tamu/, cetak/
deploy/penerbit.nginx.conf        dari tahsin.nginx.conf
deploy-penerbit.sh                dari deploy-tahsin.sh (gate: pytest penerbit/ + typecheck + vitest)
```

## Keputusan teknis

1. **Satu tokenizer, di server.** Misi dikirim ke browser sebagai daftar token (kata,
   tanda baca, celah spasi) beserta indeksnya. Browser hanya menampilkan token dan
   mengirim indeks yang diklik. Kunci jawaban di JSON ditulis sebagai teks
   ("tapi tapi"), dan `impor_course` mengubahnya ke indeks token. Dengan begitu tidak
   ada dua tokenizer yang bisa berbeda.
2. **Penilaian per klik di server, kunci tidak dikirim ke browser.** Rancangan Situs
   menilai di browser lalu dicek ulang di server. Plan ini memilih
   `POST misi/<id>/klik/` per klik yang langsung menjawab "ketemu" atau "meleset".
   Satu penilai, kunci tidak terlihat di devtools, dan umpan baliknya tetap cepat
   (satu request kecil). `Percobaan` menyimpan token yang sudah ditemukan, jumlah
   meleset, dan apakah petunjuk sudah dipakai. Gunting dan Ujian dikirim sekali
   lewat tombol Periksa atau Pilih. Detektor Kembar menyalakan kata yang sama di
   browser (tanpa kunci), dan server memeriksa pilihan akhirnya.
3. **Kunci ganda** = grup token. Salah satu anggota grup diklik → grup itu ketemu.
4. **Syarat stiker sebagai data.** Setiap Alat punya `syarat` per tingkat:
   ```json
   {"perunggu": {"jenis": "misi_tahap_selesai", "tahap": ["bersama", "petunjuk"]},
    "perak":    {"jenis": "skor_beruntun", "min_benar": 4, "dari": 5, "kali": 2},
    "emas":     {"jenis": "jejak_maks", "angka": "kalimat_terpanjang", "maks": 20, "cerita": 2}}
   ```
   Jenis yang didukung kode: `misi_tahap_selesai`, `skor_beruntun`, `semua_ditemukan`,
   `jejak_maks`, `jejak_per_100_kata_maks`, `pemeriksa`. Alat musim baru memakai jenis yang sama.
   "Teks baru" untuk Perak = misi tahap `mandiri` atau Latihan Harian alat itu.
5. **Mesin hadiah idempoten.** `evaluasi(profil)` dipanggil setelah setiap hasil, dalam
   transaksi. `Stiker` unik per (profil, alat, tingkat); `Poin` punya `kunci_sumber`
   unik (misalnya `misi:12`, `stiker:3`), jadi evaluasi ulang tidak menggandakan poin.
   Pangkat dibaca dari data `Pangkat` (syarat jumlah Perunggu atau jumlah buku terbit).
6. **Naskah**: `DrafKerja` (satu per naskah, bisa diubah, tujuan simpan otomatis) terpisah
   dari `Versi` (immutable: `save()` menolak update, dan API tidak punya PUT/PATCH).
   Versi 1 → hitung `Jejak` dan `laci_buka = sekarang + 48 jam` (waktu server).
   Pemeriksa bisa membuka laci lebih awal.
7. **Sorotan**: disimpan sebagai daftar `{alat, index, length, sumber: anak|sistem,
   diperbaiki}`. Dibawa ke versi baru, dan sorotan yang teksnya berubah otomatis
   menjadi "sudah diperbaiki". Logika ini ada di `src/editor/sorotan.ts` dan diuji
   dengan vitest. Sorotan sistem Lapis 3 (kata kembar, kalimat lebih dari 20 kata)
   dihitung server dari `teks.py` + `kata_umum.py` dan dikirim sebagai sorotan `sistem`.
8. **Mode editor**: Draf Nol memblokir Backspace/Delete/Cut selama timer berjalan
   (keyboard binding Quill), tempel dari luar diblokir (clipboard matcher; memindah
   teks di dalam editor yang sama tetap boleh), dan `spellcheck=false
   autocorrect=off autocapitalize=off` di root editor.
9. **Offline**: hanya simpan naskah. Antrean di `localStorage['penerbit.draf.<id>']`
   dengan timestamp, dikirim ulang saat `online`; server menolak draf yang lebih tua
   dari yang tersimpan.
10. **Tanpa Tailwind.** Gaya sepenuhnya dari `shared.css` + `menulis.css`, supaya
    kelas course GDevelop dipakai apa adanya. Perilaku `shared.js` ditulis ulang
    sebagai komponen React (Tab, Checklist, Ujian, TombolSalin).
11. **Pemeriksa dengan lebih dari satu penulis**: pilihan penulis di nav `/ortu/`,
    dikirim sebagai `?penulis=<id>`, diingat di `localStorage`.
12. **Cetak**: halaman React biasa dengan `cetak.css`; memanggil `window.print()`
    setelah data termuat. Lembar per modul = satu halaman dengan banyak lembar dan
    `page-break-after`. Buku A5: `@page { size: A5 }`.
13. **Sampul buku**: media terlindungi lewat `X-Accel-Redirect` (pola english),
    lokasi `/protected-penerbit-media/`.
14. **Isi course sebagai JSON per modul** (`modul-01.json` … `modul-16.json`,
    `alat.json`, `pangkat.json`, `latihan.json`, `bertanya.json`). `test_isi_course`
    memvalidasi semua file: setiap kunci ada di teks, jumlahnya sama dengan yang
    tertulis, setiap kode lembar unik dan dirujuk, dan setiap alat punya syarat untuk
    ketiga tingkat.
15. **Dokumen review isi**: satu doc Claude per kelompok modul, dibuat dari JSON oleh
    skrip kecil, supaya yang Anda review selalu sama dengan yang diimpor.

## Endpoint (prefix `/api/penerbit/`)

| Area | Endpoint |
|---|---|
| Umum | `me/` |
| Penulis | `beranda/`, `alat/`, `modul/<n>/`, `misi/<id>/` (token, tanpa kunci), `misi/<id>/klik/`, `misi/<id>/periksa/`, `misi/<id>/petunjuk/`, `misi/<id>/tandai/`, `misi/<id>/cetak/`, `ujian/<id>/jawab/`, `bertanya/<id>/jawab/`, `latihan/`, `latihan/jawab/`, `ide/`, `naskah/`, `naskah/<id>/`, `naskah/<id>/simpan/`, `naskah/<id>/versi/`, `naskah/<id>/sorotan-sistem/`, `naskah/<id>/minta-stempel/`, `naskah/<id>/favorit/`, `jejak/`, `rak/`, `rak/<id>/`, `cetak/<kode>/`, `prompt/`, `penukaran/` |
| Pemeriksa | `ortu/dasbor/`, `ortu/lembar/`, `ortu/lembar/<id>/`, `ortu/naskah/`, `ortu/naskah/<id>/` (+ `stempel/`, `catatan/`, `ulasan/`, `bagikan/`, `buka-laci/`, `terbitkan/`, `berani-hapus/`), `ortu/stiker/` (+ beri), `ortu/hadiah/`, `ortu/penukaran/<id>/`, `ortu/poin/`, `ortu/cetak/`, `ortu/prompt/` |
| Editor Tamu | `ulasan/`, `ulasan/<id>/`, `ulasan/<id>/kirim/` |

## Fase (masing-masing commit terpisah dan test-first)

| Fase | Isi | Selesai bila |
|---|---|---|
| 1 | App `penerbit`, model course + progres + naskah, migrasi, admin, `peran.py`, `me/`, aturan 404 | test_peran hijau |
| 2 | `teks.py`, format JSON + `impor_course`, JSON Modul 1–5 + alat + pangkat dari Roadmap, test_isi_course | Modul 1–5 terimpor, semua kunci valid |
| 3 | `penilaian.py` + endpoint misi/ujian/bertanya | test_penilaian hijau |
| 4 | `hadiah.py` (poin, stiker berbasis data, pangkat) + test_musim_data (alat fiktif) | test_hadiah + test_musim_data hijau |
| 5 | `jadwal.py` + Latihan Harian (termasuk latihan campuran) | test_jadwal hijau |
| 6 | `jejak.py`, Ide, Naskah, DrafKerja, Versi, Laci, sorotan sistem | test_jejak (angka Sandal Jepit) + test_naskah hijau |
| 7 | Endpoint Pemeriksa (lembar, stiker, stempel, hadiah, penukaran, prompt, cetak, terbitkan) + Editor Tamu | test_ortu + test_tamu hijau |
| 8 | test_perjalanan (Modul 1 → Terbit lewat API) | hijau |
| 9 | Frontend skeleton: Vite, gaya, auth, nav, Masuk, routing per peran | vitest auth + build |
| 10 | Komponen latihan (KlikKesalahan, Gunting, DetektorKembar, UjianAB, LatihanBertanya, Timer, TombolSalin) | vitest komponen |
| 11 | Halaman Penulis: Beranda, Kartu Alat, Modul, Misi, Latihan Harian, Jejak | cocok mock-up |
| 12 | Editor (4 mode, stabilo, sorotan, antrean offline) + Ruang Penulis, Naskah baru, Draf Nol, Halaman naskah, Revisi, Bandingkan | vitest editor + cocok mock-up |
| 13 | KotakPrompt 3 tahap + refleksi | vitest |
| 14 | Area Pemeriksa (7 halaman) + Editor Tamu + Rak Buku | cocok mock-up |
| 15 | Halaman cetak (lembar, per modul, versi hitam putih, buku A5) | dicetak sungguhan |
| 16 | Isi Modul 6–9 (draf → review → impor) | review disetujui + test_isi_course |
| 17 | Isi Modul 10–16 | sama |
| 18 | Bank Latihan Harian + Latihan Bertanya | sama |
| 19 | Deploy: nginx, certbot, `ALLOWED_HOSTS`, `deploy-penerbit.sh`, `ekspor_naskah` | uji manual di tablet (spec §7) |

Fase 16–18 (isi) bisa berjalan paralel dengan fase 9–15 karena hanya menyentuh JSON.
Setiap fase meminta persetujuan Anda sebelum fase berikutnya dimulai.

## Risiko

- **Ukuran**: 23 halaman, 4 mode editor, sekitar 90 file JSON isi. Fase kecil dengan
  test sendiri-sendiri menjaga supaya kesalahan cepat ketahuan.
- **Quill dan sorotan setelah teks diedit**: bagian paling rumit. Diuji dengan vitest
  memakai skenario contoh "Fatih sedih." dari mock-up.
- **Tablet**: perilaku keyboard (Backspace di keyboard virtual Android) bisa berbeda
  dari desktop. Diuji di tablet sungguhan di akhir fase 12, bukan hanya di fase 19.
