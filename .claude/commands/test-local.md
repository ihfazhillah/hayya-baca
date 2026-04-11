---
description: Build dev app, jalankan backend lokal, install ke emulator
---

Jalankan `./scripts/test-local.sh` dari root project untuk:

1. Cek adb emulator attached (fail fast kalau belum ada).
2. `npm test` (full suite) sebagai gate.
3. Start Django backend di `0.0.0.0:8123` (pakai `backend/.venv`), migrate dulu. Skip kalau port sudah listen.
4. `npx expo run:android` — dev build, install ke emulator yang running.

Flags opsional yang bisa diteruskan user (sampaikan kalau relevan):
- `--skip-tests` — lewati `npm test` (hanya untuk iterasi cepat).
- `--skip-backend` — pakai backend yang sudah jalan / remote.
- `--skip-build` — hanya pastikan backend + emulator siap, tidak rebuild.

Catatan:
- Emulator resolve backend via `http://10.0.2.2:8123` (sudah di-hardcode `src/lib/api.ts` saat `__DEV__`).
- Backend log di `/tmp/hayya-baca-backend.log`, PID di `/tmp/hayya-baca-backend.pid`.
- Kalau test gagal, **jangan** pakai `--skip-tests` untuk by-pass — fix dulu.
- Backend `.venv` harus sudah ter-setup (`cd backend && uv sync`). Script tidak auto-install dep.

Setelah script selesai, verifikasi manual:
- Buka app di emulator, login, trigger sync dari Parent page, cek `http://localhost:8123/admin/` untuk data masuk.
