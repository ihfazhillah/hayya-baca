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

---

## Next steps (findings dari run pertama — commit 5ceda8c)

Harness 6/7 hijau pada run pertama. Satu kegagalan adalah **bug backend nyata** yang lolos dari Fase B2 plan.md, bukan bug di harness.

### Finding #1 — Bug #9 backend belum terima `coin_spend`

**Gejala:** Case 4 `pushRewardsBulk` dengan `type: "coin_spend"` → HTTP 400 dari DRF:
```
{"rewards":[{},{"type":["\"coin_spend\" is not a valid choice."]}]}
```

**Root cause:**
- `backend/rewards/models.py:7-11` — `RewardHistory.Type` hanya punya `coin`, `star`, `coin_adjustment`, `star_adjustment`.
- `backend/rewards/serializers.py:17` — `ChoiceField(choices=RewardHistory.Type.choices)` otomatis reject.
- Commit `32354e1` (`fix(sync): #9 game spend persisted via reward_history`) menyelesaikan client — `addReward(childId, 'coin_spend', ...)` — tapi **tidak pernah** menambah type di backend. Dev tidak crash karena `coin_spend` belum benar-benar dicoba push ke server lokal sebelum ini (error 400 di-swallow ke `report.errors`, tidak block sync lain).

**Dampak lapangan:** Setiap pembelian game pada client yang sudah dapat commit `32354e1` → reward masuk ke lokal SQLite `synced=0`, tiap sync push 400, tidak pernah `synced=1`. Counter `queue_depth_rewards` terus naik. Server tidak pernah tahu koin anak di-spend → leaderboard/parent dashboard over-count.

**Fix rencana (satu commit terpisah — `fix(sync): #9 backend accepts coin_spend reward type`):**

1. **Model:** tambah `COIN_SPEND = "coin_spend"` ke `RewardHistory.Type` di `backend/rewards/models.py`.
2. **Migration:** `backend/rewards/migrations/0003_rewardhistory_coin_spend.py` — alter `type` choices. Sqlite tidak butuh table rewrite untuk choices (cuma metadata), tapi Django masih emit `AlterField` — biarkan saja, aman.
3. **Serializer (`backend/rewards/serializers.py:67`):** periksa apakah aggregation server-side perlu masukkan `coin_spend` ke update coin total. Kalau ya, tambah ke tuple `(RewardHistory.Type.COIN, RewardHistory.Type.COIN_ADJ, RewardHistory.Type.COIN_SPEND)`. Konfirmasi dulu apa yang dihitung server-side sebelum edit — kalau server cuma store history dan client yang recalc, cukup choices saja.
4. **Manual verification (dev):**
   - `test-local.sh` stop → `seed_e2e` DB beda, jangan campur — cukup `./backend/.venv/bin/python manage.py migrate`.
   - Trigger buy game dari emulator → check `http://localhost:8123/admin/rewards/rewardhistory/` ada row `type=coin_spend`.
5. **E2E rerun:** `npm run test:e2e` → 7/7 hijau dua kali berturut-turut → commit.
6. **Client-side test regression check:** `usecase-game-spend-persistence.test.ts` tetap PASS (tidak bergantung choices backend).

**Stop condition:** kalau migration bentrok dengan data prod lama, tanya dulu — user bilang "backend belum deploy" (MEMORY.md) jadi harusnya aman, tapi verifikasi sebelum ship.

### Finding #2 — e2e berbagi state antar run (tidak ada reset per-test)

**Gejala:** Tidak terlihat sekarang (tiap case bikin child baru dengan `Date.now()` suffix), tapi kalau `test:e2e` dijalankan 2x berturut-turut tanpa restart harness (misal `--watch`), child dari run sebelumnya masih ada. Saat ini tidak masalah karena harness selalu fresh DB — cukup catat sebagai limitasi known.

**Fix opsional nanti:** endpoint `POST /api/sync/e2e-reset/` yang hanya terdaftar di `config.settings.e2e` → truncate RewardHistory/ReadingProgress/Child untuk user e2e. Kalau dibutuhkan (tanda: test mulai flaky karena cross-talk), implement; sekarang skip.

### Finding #3 — Subshell PID drift di harness (fixed)

Run pertama cleanup meninggalkan runserver orphaned karena `$!` dari subshell menangkap wrong PID. Sudah di-fix dengan port-fallback kill di `scripts/e2e-backend.sh` cleanup(). Catat karena pattern ini umum — kalau nambah harness lain, pakai pendekatan sama (recorded PID + port fallback).

---

## Checklist lanjutan

- [x] **Fix #1** backend `coin_spend` type + migration → e2e 7/7 → commit `794976b`
- [x] **Run kedua** e2e untuk verifikasi non-flaky — dua run berturut 7/7
- [ ] Pertimbangkan tambah e2e ke CI terpisah (butuh Python di runner — biarkan manual sekarang)
- [ ] **Opsional:** e2e-reset endpoint (Finding #2) — hanya kalau nanti ada flakiness

---

## Checklist edge-cases (dari `edge-cases.md` §1)

Status per 2026-04-11. Commit hash di kolom kanan = commit yang menambahkan test/fix. Test file: `src/__tests__/e2e-sync-backend.test.ts` kecuali disebut lain.

### Multi-device (MD-\*)
- [x] **MD-1** dua device earn koin bersamaan — `1fad109` fix + test Case 8
- [x] **MD-2 / RC-1** `completed_count` derived from reading_log — `c9ce66d`, test Case 9
- [ ] **MD-3** pull reward history saat device lain masih push — belum
- [x] **MD-4** fresh device login pull riwayat penuh — `3fdc81d`, test Case 11
- [x] **MD-5** device B spend setelah device A earn — `6c8f4bd`, test Case 12
- [ ] **MD-6** clock skew 1 jam antar device — deferred (butuh clock-mock)
- [ ] **MD-7** logout device A invalidate token device B — deferred (butuh design: per-device token)

### Multi-child (MC-\*)
- [ ] **MC-1** rapid child switch → opportunistic sync antri — belum
- [x] **MC-2** switch child flush semua children — `88b4f07`
- [x] **MC-3** force-kill mid-sync queue multi-child — `8b2d3fd`

### Kid behavior (KB-\*)
- [ ] **KB-1** rapid-tap 5 reward < 200ms → idempotency collision — belum
- [x] **KB-2** 200 reward bulk push < 5s — `5cb70d5`, test Case 17
- [x] **KB-3** spend > balance → backend reject — `fd91d9c`, test Case 18

### Offline (OL-\*)
- [x] **OL-1** mid-push network drop retry — `f9a4116`
- [ ] **OL-2** NetInfo online tapi 5xx / timeout — belum
- [ ] **OL-3** reconnect memicu sync saat manual sync masih jalan — belum

### Identity (ID-\*)
- [x] **ID-1** global idempotency_key collision surfaces skipped — `b93eea7`, test Case 20
- [ ] **ID-2** `linkChildToServer` remap clash dengan child row lain — belum
- [x] **ID-3** reading_log pull preserves idempotency_key — `3bca567`, test Case 22

### Backend contract (BC-\*)
- [ ] **BC-1** backend terima `count=-100` pada `type='coin'` (no sign validation) — belum
- [x] **BC-2** `rewards/sync/` + `reading-log/` enforce ChildAccess — `55068de`, test Case 24
- [x] **BC-3** book slug 400 hanya blok book itu — `4608f5e`, test Case 25
- [x] **BC-4** balance == sum(reward_history) pada re-push — `0dd2abc`, test Case 26
- [x] **BC-5** reward history pull 1000 entries < 3s — `3e1c253`, test Case 27
- [x] **BC-6** reading_progress resolve slug → pk → stub — `7c947e3`/`0ea5255`, test Case 29
- [ ] **BC-7** article slug drift saat judul diedit server — belum

### Reading counter (RC-\*)
- [x] **RC-1** = MD-2 (dicover bersamaan)
- [ ] **RC-2** `last_page` regression `12→3→12` dalam satu sesi — belum

### Auth / session (AS-\*)
- [ ] **AS-1** token expire mid-sync — belum
- [ ] **AS-2** login account B saat local DB ada account A data — belum

**Total:** 16/30 done, 14 remaining (3 deferred design-first, 11 realistic untuk e2e).

---

## Risk assessment — mana yang kemungkinan jadi masalah di app sekarang

Analisa tiap edge case yang belum ditutup: seberapa besar kemungkinan bug **saat ini** nyangkut di user lapangan, dan plan investigasi kalau muncul.

### 🔴 High risk — kemungkinan besar sudah/akan menggigit user

#### **MD-7 / AS-1** — single token per user (CRITICAL)

**Kenapa high:** `backend/accounts/views.py:34` pakai `Token.objects.get_or_create(user=user)` — DRF default TokenAuthentication punya satu row per user. Implikasi:
1. **MD-7:** Login di HP mama → login lagi di tablet Aisyah (user sama). `get_or_create` return token yang sama → HP tetap valid. OK so far. Tapi kalau HP mama **logout**, `accounts/views.py:61` delete token → tablet Aisyah langsung 401 diam-diam pada sync berikutnya. Kid lagi asyik baca, tiba-tiba reward tidak ter-persist.
2. **AS-1:** Token tidak pernah expire sendiri di DRF default, jadi "expire mid-sync" hanya terjadi via route (1) atau admin force-delete. Tetap, dampaknya identik dengan MD-7.

**Cara analisa kalau user lapor "reward hilang setelah logout di device lain":**
- Minta user buka `Orang Tua → Manual Sync` — kalau tombol itu error "401" / "Token tidak valid", konfirm hipotesis.
- Check backend `authtoken_token` table — kalau cuma 1 row per user, diagnosis pasti.
- Log sisi client: sudah ada `report.errors` — cek `src/lib/sync.ts:42` apakah 401 dilog spesifik, kalau tidak, tambahkan sentinel error `AUTH_401` supaya parent dashboard bisa surface-kan "perlu login ulang".

**Action:** sebelum bikin test, design decision dulu — switch ke per-device token (DRF `knox` atau custom model dengan `device_id` field). Flag di plan.md Fase E.

#### **ID-2** — `linkChildToServer` ID remap clash

**Kenapa high:** `src/lib/sync.ts:156-159` — saat create child offline, local pakai autoincrement id, push ke server dapat server id, lalu remap local row. Kalau server-side id **bentrok** dengan child row lain yang sudah ada (misal: user sebelumnya punya Aisyah local.id=3, lalu server return id=3 untuk child baru "Fatimah"), `UPDATE children SET id=3 WHERE ...` akan hit UNIQUE constraint atau overwrite Aisyah. Reading_log/reward_history yang sudah pakai `child_id=3` jadi nyasar.

**Cara analisa kalau "anak A tiba-tiba punya reward anak B":**
- Query local SQLite: `SELECT id, name, server_id FROM children WHERE id IN (SELECT DISTINCT child_id FROM reward_history)` — lihat apakah ada dua nama pakai id sama dalam history.
- Cek `sync_log` (kalau ada di local) untuk link events.
- Repro step: offline, create 2 anak beruturut; online, sync — cek mapping.

**Action:** tulis test e2e yang force bentrok (two offline children, seed server dengan children lain dulu). Fix direction: remap pakai temp negative id sebelum UPDATE. **P2, worth doing.**

### 🟡 Medium risk — bisa kejadian, tapi gejalanya self-healing atau cosmetic

#### **BC-1** — `count=-100` pada `type='coin'`

**Kenapa medium:** Serializer hanya validasi `choices`, tidak validasi sign. Client **sekarang** tidak pernah push negative coin (coin_spend pakai count negatif tapi type `coin_spend`), tapi kalau ada bug UI yang accidentally kirim `count=-5 type='coin'`, server accept → balance underflow. Belum pernah ada report, tapi tidak ada guard.

**Analisa kalau user lapor "koin minus":** query `SELECT child_id, type, count FROM rewards_rewardhistory WHERE type='coin' AND count < 0` — kalau ada row, confirm.

**Action:** 1 line serializer fix + test. Quick win, kerjakan segera.

#### **OL-2** — NetInfo online tapi 5xx / timeout

**Kenapa medium:** `sync.ts` pakai `attachNetInfoReconnectTrigger` yang fire sync saat network flap. Kalau server 5xx (Django crash, reverse-proxy restart), sync fail, errors di-log, **tapi retry hanya saat NetInfo flap lagi**. Bisa stuck puluhan menit sampai user toggle airplane mode.

**Analisa:** cek `queue_depth_rewards` di parent dashboard — kalau terus naik padahal user bilang "internetnya nyala", konfirm. Backend log `5xx by IP` cross-ref jam.

**Action:** exponential backoff internal saat receive 5xx (bukan cuma NetInfo). Medium effort, kerja setelah telemetri dashboard ada.

#### **OL-3** — reconnect trigger saat manual sync masih jalan

**Kenapa medium:** tidak ada mutex di `syncAll()`. Kalau user tekan Manual Sync, lalu koneksi flap (reconnect trigger), `syncAll()` kedua jalan paralel → dua push bulk dengan idempotency key yang sama → backend dedupe, tapi `queue_depth_rewards` telemetri bisa double-count. Cosmetic, tidak data loss.

**Analisa:** sudah dicover sebagian oleh MC-3 persistence. Kalau user lapor "telemetri queue stuck padahal sync jalan", cek log untuk dua `PUSH_REWARDS` SyncLog rows dalam 1 detik.

**Action:** tambah `isSyncing` flag di `sync.ts`. Low effort, eat up anytime.

#### **RC-2** — `last_page` regression dalam sesi

**Kenapa medium:** `reading_progress` server-side pakai MAX(last_page, incoming). Kalau kid re-open buku dari awal (halaman 1), client push `last_page=1`, server tetap simpan 12 (existing). **Ini intentional behavior**, tapi UI mobile kadang tampilkan last_page dari local yang lebih kecil → mismatch dengan server. Cosmetic untuk reward (completed_count sudah dipisah ke reading_log — fixed by MD-2). 

**Analisa:** Kalau user lapor "bookmark salah", query `SELECT book_id, last_page, completed_count FROM reading_progress WHERE child_id=?` di local vs server.

**Action:** skip for now — tidak dampak reward integrity.

### 🟢 Low risk — edge-of-edge, skip sampai ada laporan

- **MD-3** pull during push: backend SQLite serialize writes, client idempotent → konvergen di run berikutnya. Skip.
- **MD-6** clock skew: backend pakai server time untuk `created_at` (bukan client-provided dalam kebanyakan jalur). Dampak terbatas ke "sort order di timeline". Skip.
- **MC-1** rapid child switch: sudah dicover parsial oleh MC-2 (session switch flush). Skip sampai ada laporan flake.
- **KB-1** rapid-tap idempotency: client pakai `uuid` per reward, collision essentially zero. Skip.
- **BC-7** article slug drift: mitigated oleh BC-6 stub fallback. Skip.
- **AS-2** account switch local data: butuh design ("clear local data on logout?"). Skip sampai user request.

### Urutan prioritas kerjaan berikutnya

1. **BC-1** — cepat (1 commit, serializer fix + test), tutup kemungkinan balance underflow.
2. **ID-2** — P2 tapi data-integrity risk. Test dulu (expected FAIL), lalu fix.
3. **OL-3** — mutex di syncAll, mudah.
4. **MD-7 / AS-1** — butuh design decision token-per-device. Pindah ke plan.md Fase E, bahas dulu sebelum implement.
5. **OL-2** — setelah backoff strategy didiskusikan.

Sisa (MD-3, MD-6, MC-1, KB-1, BC-7, RC-2, AS-2) → defer, dokumentasi cukup.

---

## Toolkit analisa root-cause untuk laporan lapangan

Supaya kalau user lapor bug, ada jalur pasti untuk diagnosis:

1. **Parent dashboard telemetri** (plan.md §7.1) — `queue_depth_rewards`, `last_sync_error`, `last_successful_sync_at` per device. **Tanpa ini, semua diagnosis lapangan cuma tebak-tebakan.** Prioritas tertinggi setelah BC-1.
2. **SyncLog export** — `backend/sync/models.py SyncLog` sudah catat push events. Tambah admin action "Export CSV per child" supaya bisa minta log sebelum memanggil user.
3. **Client-side debug bundle** — Parent page tambah tombol "Kirim log ke support" yang tarik last 50 rows dari local `sync_log`+`reward_history unsynced` dan share via email/clipboard.
4. **Backend `manage.py reading_report`** — sudah ada, extend untuk per-device breakdown.

Hitungan quick ROI: **parent telemetri dashboard** unblock 5 dari 14 edge cases di atas (MD-7, OL-2, OL-3, ID-2, AS-1) dari "tebakan" ke "data-driven". Itu investasi yang benar sebelum lanjut test coverage.

