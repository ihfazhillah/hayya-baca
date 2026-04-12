# Hayya Baca — Project Rules

## Local testing (dev build + backend)

Untuk test lokal dengan emulator Android + backend Django, **selalu** pakai `./scripts/test-local.sh` atau slash command `/test-local`. Jangan jalankan `expo run:android` dan `manage.py runserver` manual — script sudah handle urutan (test gate → migrate → backend → dev build) dan kebersihan state (reuse backend yang sudah listen, PID/log file konsisten).

- Backend port **wajib 8123** (hard-coded di `src/lib/api.ts` via `API_BASE_DEV = http://10.0.2.2:8123/api`). Jangan ubah port tanpa update `api.ts` juga.
- Emulator harus sudah running sebelum script dijalankan — script fail-fast kalau `adb devices` kosong.
- `backend/.venv` harus ada (`cd backend && uv sync` sekali di setup).
- Flag `--skip-tests` hanya untuk iterasi cepat saat debug, jangan dipakai sebagai default.

## E2E test (real HTTP ke Django lokal)

`npm run test:e2e` — spin up backend terisolasi di port **8124** dengan DB di `/tmp/hayya-baca-e2e.sqlite3`, jalankan `src/__tests__/e2e-sync-backend.test.ts`, teardown + hapus DB di akhir. Zero impact ke dev runserver (8123) dan `backend/db.sqlite3`.

- Tidak termasuk di default `npm test` (di-ignore via `testPathIgnorePatterns`).
- Harness: `scripts/e2e-backend.sh`. Settings module: `config.settings.e2e`. Seed: `manage.py seed_e2e`.
- Set `E2E_KEEP_DB=1` untuk debug — DB file tidak dihapus saat teardown.

## Build release

Pakai `./build-release.sh` — gating di `npm test`, signed APK, tag + GitHub release. Jangan amend release lama.

## Test philosophy

- Use-case level, bukan unit. File di `src/__tests__/usecase-*.test.{ts,tsx}`, pakai `better-sqlite3` real.
- Test-first: tulis test yang FAIL dulu, baru fix. Kalau test tidak fail, hipotesis salah — stop, pikir ulang.
- Satu bug satu commit. Pesan: `fix(<area>): #N <desc>`. Tidak ada Co-Authored-By (lihat memory `feedback_no_attribution`).
