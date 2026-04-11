# Plan E2E — Actual End-to-End Test ke Local Backend

**Spec:** [spec.md](./spec.md) · **Parent plan:** [plan.md](./plan.md) (Fase D)
**Tujuan:** Verifikasi sync flow real HTTP ke Django backend, bukan mock. Melengkapi `usecase-full-reward-lifecycle.test.ts` (yang masih in-process) dengan round-trip lewat network stack + DRF + ORM beneran.

---

## Prinsip

1. **Real HTTP, real Django, real migration.** Tidak ada mock API. Client test pakai `fetch` ke `http://127.0.0.1:<port>`.
2. **Database terisolasi total** dari `runserver` dev (port 8123, `db.sqlite3`). Dev boleh tetap jalan saat e2e berjalan — zero interference.
3. **Ephemeral.** DB dibuat saat setup, dihapus saat teardown. Tidak ada state leak antar run.
4. **Gating opsional.** `npm test` default **tidak** menjalankan e2e (butuh Python + backend siap). Jalur terpisah: `npm run test:e2e`.
5. **Offline-first tetap valid.** E2e test hanya menambah coverage; test use-case existing tetap authoritative untuk logic.

---

## Arsitektur isolasi

### Settings module baru: `backend/config/settings/e2e.py`

```python
from .base import *  # noqa
import os

DEBUG = False
ALLOWED_HOSTS = ['*']
SECRET_KEY = 'e2e-secret-not-for-production'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.environ.get('E2E_DB_PATH', '/tmp/hayya-baca-e2e.sqlite3'),
    }
}

# Disable throttling / rate limits kalau ada
REST_FRAMEWORK = {**globals().get('REST_FRAMEWORK', {}), 'DEFAULT_THROTTLE_CLASSES': []}
```

**Kenapa file baru, bukan env var toggle di `dev.py`?** Biar eksplisit — `DJANGO_SETTINGS_MODULE=config.settings.e2e` tidak mungkin ke-pick saat dev normal. Zero risk nabrak `db.sqlite3`.

### Port & DB path

- Backend e2e listen di **port 8124** (dev pakai 8123, jadi bisa coexist).
- DB file di `/tmp/hayya-baca-e2e.sqlite3` — di luar repo, aman dari git.
- PID file `/tmp/hayya-baca-e2e-backend.pid`, log `/tmp/hayya-baca-e2e-backend.log`.

### Harness script: `scripts/e2e-backend.sh`

Tanggung jawab:
1. **Preflight:** pastikan `backend/.venv` ada, port 8124 free, `node` + `npm` ada.
2. **Setup DB:**
   - `rm -f /tmp/hayya-baca-e2e.sqlite3`
   - `DJANGO_SETTINGS_MODULE=config.settings.e2e .venv/bin/python manage.py migrate --noinput`
   - Seed data via custom management command `seed_e2e` (lihat bawah) — idempotent.
3. **Start backend:**
   - `nohup .venv/bin/python manage.py runserver 127.0.0.1:8124 --noreload > log 2>&1 &`
   - Tulis PID. Poll `ss -tln` max 10 detik sampai port listen.
4. **Run jest:**
   - `API_BASE_URL=http://127.0.0.1:8124/api npx jest --config jest.e2e.config.js --runInBand`
   - Exit code di-capture.
5. **Cleanup (trap EXIT):**
   - Kill PID (graceful TERM, fallback KILL setelah 2 dtk).
   - `rm -f /tmp/hayya-baca-e2e.sqlite3`
   - `rm -f` PID + log files.
   - Exit dengan exit code jest.

Trap EXIT memastikan cleanup jalan walau test fail, Ctrl-C, atau backend crash mid-run.

### Seed data: `backend/sync/management/commands/seed_e2e.py`

Idempotent, dipanggil setelah migrate:
- Buat superuser `e2e@test.local` / password `e2e-password` via `create_superuser` kalau belum ada.
- Buat 1 regular user `parent@test.local` / `parent-password` (atau langsung pakai superuser — simpler).
- Buat 4 `Book` dengan slug `"1".."4"` (match static JSON app).
- **Tidak** seed Children — child dibuat oleh test case via API push (atau via fixture helper kalau endpoint create-child ada).

**Kenapa management command bukan inline SQL/fixture?** Fixture JSON rapuh kalau schema berubah. Command pakai ORM → survive migration drift.

---

## Client-side: bagaimana test bicara ke backend

### Jest config terpisah: `jest.e2e.config.js`

- `testMatch: ['**/src/__tests__/e2e-*.test.ts']`
- `setupFilesAfterEach: ['./jest.e2e.setup.ts']` — di sini setup global `fetch` + helper login.
- Sama `preset` dengan jest.config.js utama (jest-expo) biar resolver konsisten.
- **Tidak** set `testEnvironment: 'node'` dulu — biarkan jest-expo defaults. Kalau ada masalah fetch polyfill, switch ke `node`.

### Sync client di test: dua opsi

**Opsi 1 — Pakai `src/lib/api.ts` + `src/lib/sync.ts` langsung** (preferred)
- Override `API_BASE_DEV` tidak bisa dari env karena di-hardcode. **Solusi:** ubah `getApiBase()` supaya honor `process.env.API_BASE_URL` juga saat `__DEV__`. Satu line change, aman untuk dev normal (env biasanya empty).
- Test pakai `better-sqlite3` real (seperti usecase tests) untuk local DB per-device.
- Keuntungan: test jalan di code path nyata — `pushRewardsBulk`, `pullAll`, `mergeServer*` semuanya real.

**Opsi 2 — Pure fetch client baru di test**
- Tulis helper `e2eClient.ts` yang replicate login + push + pull endpoints.
- Kerugian: duplikasi logic, bisa drift dari `api.ts`. **Tolak.**

Pilih **Opsi 1**. Modif `api.ts`:

```ts
function getApiBase(): string {
  const override = Constants.expoConfig?.extra?.apiBaseUrl || process.env.API_BASE_URL;
  if (override) return override;
  return __DEV__ ? API_BASE_DEV : API_BASE_PROD;
}
```

`Constants.expoConfig` tidak tersedia di jest (sudah di-mock di `jest.setup.ts`). Test set `process.env.API_BASE_URL` sebelum import `api.ts` — Jest reset modules antar test.

### Device simulation

Tiap "device" di test = instance `better-sqlite3` `:memory:` + token sendiri. Helper:

```ts
function makeDevice(name: string) {
  const db = new Database(':memory:');
  runMigrations(db);  // reuse dari usecase tests
  return { name, db, token: null as string | null };
}
```

Login tiap device dapat token berbeda (backend seharusnya tidak mempermasalahkan — DeviceTelemetry pakai `device_id` field).

---

## Skenario test (file: `src/__tests__/e2e-sync-backend.test.ts`)

Satu file, satu `describe`, beberapa `test`. Urutan penting: test lebih awal membangun state untuk test berikutnya **tidak boleh** — setiap test reset state via helper `resetBackend()` yang call management command `seed_e2e --reset`.

### Case 1 — Login round-trip
Smoke: device login → token valid → `GET /api/children/` 200. Kalau ini gagal, test lain skip.

### Case 2 — Bug #1: push semua 4 anak
- Device A seed 4 children lokal, tiap anak 2 reward `synced=0`.
- Call `syncAll()` tanpa childIds.
- Assert backend punya 8 reward total via `GET /api/rewards/`.

### Case 3 — Bug #2: opportunistic push
- Device A: `addReward(child, 'coin', 5)` → tunggu 600ms → assert backend punya 1 reward baru.

### Case 4 — Bug #9: coin_spend persist
- Device A: earn 50 → spend 20 via `addReward type=coin_spend` → sync.
- Assert backend menerima `coin_spend` (tidak reject 400).
- Pull ke device B → balance device B = 30.

### Case 5 — Bug #4: MAX merge reading_progress
- Device A set `last_page=12`, push.
- Device B set `last_page=3`, push.
- Device A pull → last_page harus **12** (bukan 3).
- Device B pull → last_page harus **12**.

### Case 6 — D2: device telemetry
- Device A push dengan field `device_id`, `queue_depth_rewards`, `app_version`.
- `GET /api/sync/telemetry/` (atau query DB via management command helper) → assert row ada, last_seen recent.
- Device A push lagi → row di-upsert, tidak duplicate.

### Case 7 — Full lifecycle 2-device
- A earn → sync → B pull → B earn → B sync → A pull → assert A.balance = total.
- Versi real HTTP dari `usecase-full-reward-lifecycle.test.ts`.

Total: 7 test. Target runtime <30 detik (backend warm setelah case 1).

---

## npm scripts

`package.json`:
```json
"test:e2e": "./scripts/e2e-backend.sh",
"test:e2e:keep": "E2E_KEEP_DB=1 ./scripts/e2e-backend.sh"
```

`E2E_KEEP_DB=1` skip cleanup DB — untuk debugging. Script tetap kill backend (biar port free), cuma DB file yang ditinggal.

---

## Urutan eksekusi (kalau di-approve)

1. **Test-first discipline tidak applicable** — ini infra, bukan bug fix. Tapi: tulis skeleton test dulu yang login ke localhost:8124 dan **fail karena backend belum jalan**, baru tulis harness. Itu bukti harness benar-benar menjembatani.
2. Langkah:
   1. `backend/config/settings/e2e.py` + `seed_e2e` command.
   2. `scripts/e2e-backend.sh` + verifikasi manual: jalankan script, confirm backend up, DB file ada, Ctrl-C → cleanup bersih.
   3. Modif `src/lib/api.ts` untuk honor `API_BASE_URL` env.
   4. `jest.e2e.config.js` + `jest.e2e.setup.ts`.
   5. `src/__tests__/e2e-sync-backend.test.ts` — Case 1 dulu (smoke). Run, PASS.
   6. Tambah Case 2-7 satu per satu.
   7. `package.json` scripts.
   8. Update `CLAUDE.md`: dokumentasi `npm run test:e2e`.
3. **Tidak commit sebelum semua 7 case PASS dua kali berturut-turut** (ensure no flaky state). Satu commit akhir: `test(sync): e2e suite against real Django backend`.

---

## Risk & mitigasi

| Risk | Mitigasi |
|---|---|
| Port 8124 kebentur proses lain | Preflight check di script, fail-fast dengan pesan jelas |
| `fetch` tidak tersedia di jest-expo env | Fallback ke `node-fetch` polyfill di `jest.e2e.setup.ts` |
| `better-sqlite3` schema drift dari app migration | Reuse `runMigrations()` helper dari usecase tests — single source of truth |
| Backend crash mid-test → PID file stale | Trap EXIT + `kill -0` check di preflight next run |
| Test pollute `db.sqlite3` dev | **Tidak mungkin** — settings module beda, DB path beda, port beda |
| CI belum punya Python | `npm test` tetap skip e2e. `npm run test:e2e` hanya di developer machine / CI job terpisah |
| api.ts env override bocor ke prod build | `process.env.API_BASE_URL` di-inline oleh Metro pada build time — kalau env kosong saat build release, override = undefined = no-op |

---

## Stop conditions (tanya user)

- **Case 1 smoke gagal** (login round-trip) → stop, investigasi apakah endpoint/port/migration salah. Jangan force lanjut.
- **Modif `api.ts` butuh lebih dari 1 function** → stop, reconsider. Harusnya minimal.
- **Runtime test >2 menit** → stop, ada yang salah (mungkin polling loop tak berakhir).
- **Butuh dep baru** (`node-fetch`, dll) → konfirmasi dulu.

---

## Keputusan yang perlu user konfirmasi sebelum mulai

1. **Port 8124** OK, atau mau beda? (8123=dev, 8124=e2e, cukup jauh dari common.)
2. **Seed via management command `seed_e2e`** OK, atau prefer inline shell di script? (Command lebih robust.)
3. **Modif `api.ts` honor `process.env.API_BASE_URL`** OK? Alternatif: bikin wrapper test-only, tapi berarti code path beda dari production — kurang meaningful.
4. **`npm run test:e2e` terpisah dari `npm test`** OK? Atau mau integrate ke default gate (risiko: `build-release.sh` jadi butuh backend siap)?
5. **DB path `/tmp/hayya-baca-e2e.sqlite3`** OK, atau mau di `backend/db.e2e.sqlite3`? (Tmp lebih bersih, tidak mungkin ke-commit.)

---

**Approve plan + jawab 5 keputusan → saya mulai implementasi urutan di atas. Tidak commit sampai 7 case hijau dua kali berturut-turut.**
