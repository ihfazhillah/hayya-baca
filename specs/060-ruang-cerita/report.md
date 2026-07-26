# Laporan 060 — Ruang Cerita

**Status:** Selesai & live di produksi.
**Tanggal:** 2026-07-27
**URL:** https://ruangcerita.ihfazh.com

## Ringkasan

Ruang Cerita (PWA diary anak) dibangun penuh dari Fase 1 s/d Fase 9 sesuai
[spec.md](spec.md) & [plan.md](plan.md), dan sudah **live** di produksi pada
server `ksatriamuslim`, berbagi backend Django + Postgres yang sama dengan
Hayya Baca (produk terpisah, tanpa CORS, same-origin).

- **Backend** (Django app `diary` + perluasan `accounts`): 140 test hijau.
- **Frontend** (`diary-web/`, React+Vite+TS+Tailwind+PWA): 20 test hijau,
  `tsc --noEmit` + build bersih.
- Semua pekerjaan di-commit satu per satu dan di-push ke `master`.

## Yang live

| Area | Status |
|---|---|
| Akun anak = Django User, login username+password, lockout progresif | ✅ |
| Setup/reset password anak via QR + kode (token 15 mnt) | ✅ |
| Guard endpoint wali (akun anak tak bisa menyamar) | ✅ |
| Post 5 jenis, editor TipTap (ProseMirror JSON, whitelist server) | ✅ |
| Komik: upload panel → WebP (buang EXIF) + signed URL + X-Accel-Redirect | ✅ |
| Draft auto-save ke server, soft-delete, isolasi antar-saudara (404) | ✅ |
| Komentar 2 arah, reaksi emoji, read receipt "Dibaca Ayah" | ✅ |
| Feed gabungan wali + filter per anak + badge belum-dibaca | ✅ |
| Telegram link/webhook/notifikasi ber-excerpt | ✅ kode; ⏸️ belum diaktifkan (env) |
| PWA: manifest, ikon, service worker app-shell (`NetworkOnly` /api/) | ✅ |

## Topologi deploy

- Domain baru `ruangcerita.ihfazh.com` (DNS → 103.186.0.202), SSL via certbot.
- nginx site `ruangcerita`: static `/home/ihfazh/ruangcerita/dist` di `/`,
  proxy `/api/` ke socket gunicorn Hayya Baca yang sama, lokasi internal
  `/protected-media/` untuk X-Accel-Redirect. Config di repo:
  `deploy/ruangcerita.nginx.conf`.
- Backend `.env`: `DJANGO_ALLOWED_HOSTS` + `ruangcerita.ihfazh.com`,
  `DIARY_USE_X_ACCEL=1`. Backup: `backend/.env.bak.ruangcerita`.
- Script deploy ulang: `./deploy-diary.sh` (gating tsc+vitest → build → rsync →
  git pull + migrate + restart). Referensi memory: `ruang-cerita-deploy`.

## Validasi produksi (T9.4)

Journey end-to-end dites **level API** lewat stack nyata (nginx→gunicorn→Postgres):
register wali → buat anak → buat akun diary → setup token → anak set password +
login → anak buat draft puisi → publish → wali lihat di feed (unread) + detail.
Semua sukses; **seluruh data smoke dihapus** setelahnya (0 sisa, 5 PostType seed
tetap). Hayya Baca diverifikasi tetap sehat (restart gunicorn + migrasi additif).

Bagian yang **tidak** bisa diverifikasi otomatis → [manual-test.md](manual-test.md).

## Catatan penting / kejadian

- **Bug deploy ditemukan & diperbaiki:** `manage.py` default ke `config.settings.dev`
  (SQLite). Migrate manual pertama diam-diam kena SQLite, bukan Postgres → `/me/`
  sempat 500. Fix: source `.env` sebelum `migrate` (sudah di `deploy-diary.sh`).
  Memory: `backend-manage-py-defaults-dev`.
- **2 test streaks merah** (`test_sync_same_day_rejected`, `test_double_save_same_day`)
  — pre-existing di commit 4f60676, di luar scope Ruang Cerita.

## Perubahan data di produksi selama sesi ini

- `ihfazhtest` (wali) — password diubah atas permintaan user.
- `maryam` (wali baru) dibuat, dijadikan **co-wali** (orang tua kedua) untuk
  semua anak wali `ihfazh` (Sakinah, Fukaihah, Khoulah, Mimi). Password
  sementara: `MaryamTest123` (disarankan user mengganti).
- Anak keliru bernama "ihfazh" + akun `ihfazh1` yang sempat dibuat karena salah
  paham sudah **dihapus**.

## Item tertunda

Lihat bagian "Follow-ups / Tertunda" di [tasks.md](tasks.md): reset password wali
(F1), aktivasi Telegram (F2), ikon PWA raster (F3).
