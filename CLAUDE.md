# Hayya Baca

React Native / Expo app — port of the original Kotlin "Ksatria Muslim". Django backend lives under `backend/` but the primary dev surface here is the RN app.

## Commands

```bash
# Expo dev server
npm start

# Native run (device/emulator)
npm run android
npm run ios

# Tests — Jest with jest-expo preset
npm test
npm run test:watch

# TypeScript check (strict mode)
npx tsc --noEmit

# Android release APK (gates on `npm test`)
./build-release.sh

# Test build variant
./build-test.sh
```

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

## Rules

### Code Style
- TypeScript strict mode, no implicit `any`
- Path alias: `@/*` → `src/*` (see `tsconfig.json`)
- Structure:
  - `app/` — Expo Router screens
  - `src/lib/` — `api.ts`, `database.ts`, `sync.ts`, `rewards.ts`, content/session helpers
  - `src/hooks/`, `src/components/`, `src/context/`, `src/types/`
  - `content/` — static JSON book + article content
- Offline-first: local SQLite is the source of truth; sync pushes to the Django backend when online (`src/lib/sync.ts`, `src/lib/api.ts`)
- Environment values come from `app.config.ts` → `expo-constants.expoConfig.extra` (e.g. `API_BASE_URL`). No `.env`/`.env.local`.

### Git
- No `Co-Authored-By` in commit messages
- Commit messages in English
- Satu bug satu commit. Format: `fix(<area>): #N <desc>`.

### Behavior
- Plan → user approval → test → fix. For any non-trivial change, discuss edge cases up front before writing code.
- Don't be aggressive — wait for permission before acting on risky or wide-scope changes.
- High-level architecture, decisions, sync strategy, and the coin/star reward system are documented in `docs/memory.md` — read it before touching sync, rewards, guided reading, or speech flows.
- Parked ideas live in `docs/parking/`.

### Test Rules
Tests in this repo are **use-case level**, not unit tests. They are organized by user journey and should stay stable across refactors.

1. Test files live at `src/__tests__/usecase-*.test.{ts,tsx}`; shared native-module mocks live in `src/__tests__/setup.ts`. Pakai `better-sqlite3` real.
2. Test business logic and user flows — not framework plumbing or native modules (those are mocked in setup).
3. One use-case test per user journey is enough. Don't duplicate coverage across files.
4. When adding a feature, extend the matching `usecase-*` test rather than creating a new unit-style file.
5. `build-release.sh` runs `npm test` before building — keep the suite green.
6. Assert the important fields directly in happy-path tests. Don't compare full key-sets — it breaks every time a field is added.
7. Test-first: tulis test yang FAIL dulu, baru fix. Kalau test tidak fail, hipotesis salah — stop, pikir ulang.

### Learnings System
- Learning files live in `docs/learnings/` (version controlled, relative paths only)
- When the user says **"baca learnings"** / **"read learnings"** → read every file in `docs/learnings/`
- When the user says **"tulis learning"** / **"write learning"** → create a new file in `docs/learnings/`
- **Auto-write rule:** if the same type of mistake happens 3 times in one session, write a learning file without being asked.

### Worktrees
- This directory is a git worktree under `.claude/worktrees/`. Run all commands from here — do NOT `cd` to the parent repo at `/home/ihf/Projects/ksatriamuslim-android/`.
- **Metro/Expo requires `node_modules` per worktree** — symlinks don't work. After creating a worktree, run `npm ci --legacy-peer-deps` in it before any `expo run:android` or `test-local.sh`.
- For parallel worktrees: set different Metro port per worktree via `metro.config.js` (`config.server = { port: 8082 }`).
- See `docs/learnings/worktree-metro-setup.md` for full details.

### Spec-Driven Development (Manual)
- Use markdown files `spec.md`, `plan.md`, `tasks.md` under `specs/<NNN-feature>/`
- Each phase requires user approval before proceeding to the next
- Spec folders and all files inside them **must be committed** — never leave them untracked or unstaged
