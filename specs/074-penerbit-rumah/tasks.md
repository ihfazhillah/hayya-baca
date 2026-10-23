# Tasks 074 — Penerbit Rumah

Acuan: `spec.md`, `plan.md`. Tiap fase: test-first, satu commit per fase.
Persetujuan: pemilik menyetujui semua fase sekaligus (2026-10-23). Deploy ke server
(fase 19) tetap dikonfirmasi sebelum dijalankan.

## Fase 1 — App, model, peran
- [x] `backend/penerbit/` app + INSTALLED_APPS + `api/penerbit/`
- [x] models course / progres / naskah + migrasi + admin
- [x] `peran.py` + `GET me/` + helper 404
- [x] tests: test_peran

## Fase 2 — Tokenizer + impor isi
- [x] `teks.py`
- [x] `course/schema.md`, `impor_course`
- [x] JSON alat, pangkat, Modul 1–5
- [x] tests: test_impor_course, test_isi_course

## Fase 3 — Penilaian
- [x] `penilaian.py`, Percobaan, endpoint misi/ujian/bertanya
- [x] tests: test_penilaian

## Fase 4 — Hadiah
- [x] `hadiah.py` (poin ledger, stiker dari syarat data, pangkat)
- [x] tests: test_hadiah, test_musim_data

## Fase 5 — Latihan Harian
- [x] `jadwal.py`, endpoint latihan
- [x] tests: test_jadwal

## Fase 6 — Naskah
- [x] `jejak.py`, Ide, Naskah, DrafKerja, Versi, Laci, sorotan sistem
- [x] tests: test_jejak, test_naskah

## Fase 7 — Pemeriksa + Editor Tamu (backend)
- [x] endpoint `ortu/…`, `ulasan/…`
- [x] tests: test_ortu, test_tamu

## Fase 8 — Perjalanan penuh
- [x] test_perjalanan

## Fase 9 — Frontend skeleton
- [x] Vite + React, shared.css, api.ts (semua endpoint), auth + peran, routing, Masuk, vitest
## Fase 10 — Komponen latihan
- [x] TeksKlik, Gunting, DetektorKembar, UjianAB, LatihanBertanya, TombolSalin, Timer, LayoutPenulis + vitest
## Fase 11 — Halaman Penulis
## Fase 12 — Editor + halaman naskah
## Fase 13 — Kotak prompt
## Fase 14 — Area Pemeriksa + Editor Tamu + Rak Buku
## Fase 15 — Halaman cetak
## Fase 16 — Isi Modul 6–9
- [x] draf JSON (terimpor, kunci valid)
- [ ] review pemilik
## Fase 17 — Isi Modul 10–16
- [x] draf JSON (terimpor, kunci valid)
- [ ] review pemilik
## Fase 18 — Bank Latihan Harian + Latihan Bertanya
- [x] draf `latihan.json` (60 kalimat) + `bertanya` modul 1–9
- [ ] review pemilik
## Fase 19 — Deploy
