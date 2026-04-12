# Plan 01 — Implementasi Fix Sync Problem

**Spec:** [spec.md](./spec.md)
**Approach:** Option C (Reliability-first sekarang, evaluasi event-sourced nanti)
**Workflow wajib:** §4.5 spec — test → fail → fix → pass → commit, satu bug satu commit.

---

## Prinsip eksekusi

1. **Test-first.** Tulis test yang FAIL dulu, baru fix. Kalau test tidak fail, hipotesis salah — stop, pikir ulang, catat di §4.6 spec.
2. **Satu bug satu commit.** Test + fix di commit yang sama. Format pesan: `fix(sync): #N <short desc>` (tanpa Co-Authored-By, lihat [feedback_no_attribution](../../../.claude/projects/-home-ihf-Projects-ksatriamuslim-android/memory/feedback_no_attribution.md)).
3. **Use-case level test.** File di `src/__tests__/usecase-*.test.{ts,tsx}`, pakai `better-sqlite3` real seperti `integration-sync.test.ts`.
4. **`npm test` full suite hijau** sebelum commit. Jangan push regresi.
5. **Update spec setelah tiap bug.** Isi "Hasil observasi" di spec — output nyata, bukan asumsi. Spec adalah log investigasi.
6. **Offline-first non-negotiable.** Semua fix harus tetap membolehkan app jalan tanpa internet.

---

## Urutan fase

Fase A adalah blocker — fix yang langsung menyelesaikan root cause "2 pekan tidak ada data masuk". Fase B adalah consistency fix (race + counter). Fase C adalah hardening (UX indicator, trigger berlapis). Fase D adalah verifikasi integrasi & telemetri.

```
A (blocker)  →  B (consistency)  →  C (hardening)  →  D (integration + telemetry)
Bug #1,#2,#7    Bug #8,#9,#4        Bug #3,#5,#6       TC lintas-bug, logging
```

Jangan loncat fase. Fase A harus ship dulu sebagai hotfix (user butuh cepat), lalu B, C, D bisa menyusul.

---

## Fase A — Blocker (hotfix, ship ASAP)

Target: **data semua 4 anak sampai ke server secara rutin** tanpa bergantung Parent page manual.

### Step A1 — Bug #1: mount-sync & AppState push semua anak

**File test:** `src/__tests__/usecase-sync-mount-trigger.test.ts`

1. Tulis test (lihat skenario spec §Bug #1, hal. 386-403):
   - Given: logged in, 4 anak, tiap anak 1 reward `synced=0`.
   - When: `syncAll()` tanpa childIds.
   - Then (harapan post-fix): `pushRewardsBulk` dipanggil untuk **keempat** anak.
2. Jalankan: `npm test -- usecase-sync-mount-trigger`. **Harus FAIL** (cuma 0 anak atau 1 anak yang ke-push).
3. Catat output di spec §Bug #1 "Hasil observasi".
4. Fix — pilih salah satu:
   - **Opsi a (lebih bersih):** di `src/lib/sync.ts` `syncChildren`, kalau `childIds` undefined/empty → load semua child ID dari SQLite lokal (`SELECT id FROM children`) dulu, lalu proses step 2/4/5 seperti biasa.
   - **Opsi b (caller-side):** di `app/_layout.tsx:21` dan `:31`, hilangkan `[selectedChild.id]`, ganti dengan helper `getAllLocalChildIds()` → `syncAll(ids)`.
   - Rekomendasi: **opsi a** — satu titik fix, tidak ada caller yang bisa "lupa".
5. Jalankan ulang test — harus PASS. Jalankan `npm test` full suite.
6. Commit: `fix(sync): #1 sync pushes all local children, not only selected`.

### Step A2 — Bug #2: opportunistic push di `addReward` & `saveReadingProgress`

**File test:** `src/__tests__/usecase-opportunistic-push.test.ts`

1. Tulis test skenario spec §Bug #2 — `addReward` → delay 500ms → assert `pushRewardsBulk` dipanggil.
2. Run, harus FAIL. Catat di spec.
3. Fix:
   - Di `src/lib/rewards.ts` `addReward`, setelah insert berhasil, panggil helper baru `triggerOpportunisticSync(childId)` yang fire-and-forget (`.catch(() => {})`).
   - Sama untuk `saveReadingProgress`.
   - Helper pakai `syncAll([childId])` tapi **tidak** block caller. Respect `syncing` guard — kalau sync sudah jalan, skip senyap (sync yang jalan akan nangkap data baru di iterasi berikutnya asal step 2 loop childIds).
4. Test PASS, full suite PASS.
5. Commit: `fix(sync): #2 opportunistic push after addReward/saveReadingProgress`.

### Step A3 — Bug #7: trigger sync saat child dipilih

**File test:** `src/__tests__/usecase-sync-mount-race.test.ts`

1. Tulis test skenario spec §Bug #7.
2. Run, harus FAIL.
3. Fix:
   - Tambah event `"child-selected"` di `emitDataChange` atau event bus yang sudah ada.
   - `setSelectedChild` emit event setelah update state.
   - `_layout.tsx` listen → `syncAll([id])` fire-and-forget.
   - Kalau Bug #1 sudah pakai opsi a (all-children fallback), bug #7 sebagian ter-cover — tetap tulis test untuk race-nya, tapi fix bisa lebih ringan.
4. Test PASS, full suite PASS.
5. Commit: `fix(sync): #7 sync triggers on child selection change`.

**Gate Fase A:** setelah A1–A3, build alpha dan test manual skenario §7.2 spec (kill-restart loop). Kalau data masuk server → Fase A berhasil, lanjut B. Kalau tidak → review §4.6 angles.

---

## Fase B — Consistency (race & counter)

Target: **tidak ada rollback koin**, tidak ada progress mundur.

### Step B1 — Bug #8: `recalculateBalance` race

**File test:** `src/__tests__/usecase-recalculate-race.test.ts`

1. Tulis test skenario spec §Bug #8 — 50 iterasi `Promise.all([addReward, recalculateBalance])`.
2. Run. **Kemungkinan PASS** di better-sqlite3 (sequential). Kalau PASS:
   - Jangan langsung bilang "bug tidak ada". Catat di spec, tambah angle: coba dengan `await new Promise(r => setTimeout(r, 0))` di gap, atau tulis test yang langsung panggil urutan `SELECT → addReward → UPDATE` manual untuk reproduce logic race.
   - Kalau tetap PASS setelah angle, Bug #8 di-defer ke §4.6 dan fokus ke Bug #9 yang lebih pasti reproduce.
3. Kalau FAIL: fix dengan `db.withTransactionAsync` di `recalculateBalance`. Pertimbangan lebih dalam: evaluasi apakah `recalculateBalance` masih perlu ada — `children.coins` bisa jadi view `SUM(reward_history)` query on-demand, menghilangkan seluruh kelas bug.
4. Test PASS, full suite PASS.
5. Commit: `fix(sync): #8 recalculateBalance atomic via transaction`.

### Step B2 — Bug #9: game spend tercatat di `reward_history`

**File test:** `src/__tests__/usecase-game-spend-persistence.test.ts`

1. Tulis test skenario spec §Bug #9 — beli game, `recalculateBalance`, assert coin **tidak** rollback.
2. Run, **harus FAIL** (coin kembali ke 50).
3. Fix:
   - Di `app/game/[gameId].tsx:79`, ganti `updateChildCoins(selectedChild.id, -cost)` → `addReward(selectedChild.id, 'coin_spend', -cost, 'Beli game: ' + name)`.
   - Di `src/lib/rewards.ts` `recalculateBalance`: update query SUM agar akomodasi `coin_spend`:
     ```sql
     SUM(CASE WHEN type IN ('coin','coin_adjustment','coin_spend') THEN count ELSE 0 END)
     ```
   - Audit callers `updateChildCoins` lain — grep `updateChildCoins(` dan pastikan tidak ada decrement liar lagi. Kalau ada, ganti juga.
   - **Backend:** cek `backend/.../serializers.py` dan `push_rewards` endpoint — pastikan menerima type `coin_spend`. Kalau tidak, tambah ke allowed types. Ini blocker untuk sync real ke server — tandai sebagai sub-step: `fix(backend): accept coin_spend reward type`.
4. Test PASS, full suite PASS, manual test: beli game, tutup app, buka lagi, coin masih terpotong.
5. Commit: `fix(sync): #9 game spend persisted via reward_history`.

### Step B3 — Bug #4: LWW progress → MAX

**File test:** `src/__tests__/usecase-progress-merge-counter.test.ts`

1. Tulis test skenario spec §Bug #4 (last_page 12 vs 3, MAX=12).
2. Run, **harus FAIL**.
3. Fix di `src/lib/rewards.ts` `mergeServerReadingProgress`:
   - `last_page = Math.max(local.last_page, sp.last_page)`
   - `completed_count = Math.max(local.completed_count, sp.completed_count)`
   - `completed = local.completed || sp.completed`
   - `updated_at = Math.max(...)` (as string ISO OK karena monotonic).
   - Jangka panjang (di-note, bukan dikerjakan sekarang): derive `completed_count` dari COUNT(`reading_log`) — tambah issue ke §4.6 spec.
4. Test PASS, full suite PASS.
5. Commit: `fix(sync): #4 merge reading_progress uses MAX for counters`.

---

## Fase C — Hardening (UX + trigger berlapis)

Target: user **tahu** kalau sync bermasalah, trigger lebih resilient.

### Step C1 — Bug #3: unsynced indicator di child UI

**File test:** `src/__tests__/usecase-sync-indicator.test.tsx`

1. Tulis test: render child screen dengan 5 reward `synced=0`, assert ada `testID="sync-pending-badge"` dengan text "5".
2. Run, FAIL.
3. Fix:
   - Hook baru `src/lib/useUnsyncedCount.ts` — subscribe ke `emitDataChange("rewards"|"progress")`, query `COUNT(*) WHERE synced=0`.
   - Komponen badge di header child screen (dan library screen kalau relevan). Styling ringan — angka + warna amber kalau >0.
   - Tap badge → trigger manual sync (reuse `syncAll([childId])`).
4. Test PASS, full suite PASS.
5. Commit: `fix(sync): #3 unsynced indicator on child screen`.

### Step C2 — Bug #5: `recalculateBalance` tidak overwrite dari partial pull

**File test:** `src/__tests__/usecase-recalculate-partial-pull.test.ts`

1. Tulis test skenario spec §Bug #5. **Mungkin PASS** (hipotesis kemungkinan salah — spec sudah nandain).
2. Kalau PASS: catat di spec "hipotesis dieliminasi, recalc pakai local history — aman". Skip commit, lanjut.
3. Kalau FAIL: fix urutan — pull server → merge ke local history → baru recalc dari local. Commit `fix(sync): #5 recalc uses full local history after merge`.

### Step C3 — Bug #6: concurrent sync queue, bukan skip

**File test:** `src/__tests__/usecase-sync-concurrent.test.ts` (extend yang di `usecase-sync.test.ts:280`).

1. Tulis test — `Promise.all([syncAll, syncAll])` assert keduanya eventually run (bukan salah satunya `{skipped: true}`).
2. Run, FAIL.
3. Fix di `src/lib/sync.ts`: ganti boolean `syncing` dengan `syncingPromise: Promise<Result> | null`. Call kedua `await syncingPromise` lalu jalan. Hati-hati: opportunistic push (Step A2) harus tetap bisa skip senyap — beda API, mungkin `syncAll({ wait: true })` untuk manual, default false.
4. Test PASS, full suite PASS.
5. Commit: `fix(sync): #6 concurrent sync queues instead of skipping silently`.

### Step C4 — NetInfo reconnect trigger

Tidak ada bug ID — masuk daftar next actions spec §11.

1. Tulis test use-case: mock NetInfo event `isConnected: true` → assert `syncAll` dipanggil. (Test pakai `@react-native-community/netinfo/jest/netinfo-mock.js`.)
2. Fix: tambah listener di `app/_layout.tsx` (dalam useEffect yang sama dengan AppState), trigger `syncAll()` saat `isConnected && isInternetReachable`.
3. Commit: `feat(sync): flush queue on network reconnect`.

### Step C5 — Background fetch 15 menit (optional, bisa ditunda)

Butuh `expo-background-fetch` — cek apakah sudah ada di dep. Kalau tidak, **stop dan tanya user** dulu sebelum tambah dep baru. Android 14+ background fetch tidak selalu reliable (spec §9 Q3) — jadi ini nice-to-have, bukan blocker.

---

## Fase D — Integrasi & telemetri

### Step D1 — TC integrasi lintas-bug

**File test:** `src/__tests__/usecase-full-reward-lifecycle.test.ts`

Lihat skenario spec §4.5 "TC integrasi" (dua device simulate, earn → spend → sync → pull → earn → sync).

1. Tulis test dengan dua instance DB (device A, device B) + mock server yang relay event.
2. Run, harus PASS. Kalau FAIL: ada interaksi yang ke-miss antar fix — review, tambah sub-fix, commit terpisah.
3. Commit: `test(sync): end-to-end reward lifecycle across two devices`.

### Step D2 — Logging minimal (untuk observability lapangan)

Target: telemetri ringan yang piggyback ke push yang sudah ada (spec §7.1).

1. Tambah field ke payload push: `device_id`, `queue_depth_rewards`, `queue_depth_progress`, `last_successful_sync_at`, `last_sync_error`, `app_version`.
2. Server (Django): tambah kolom ke `SyncLog` model atau buat `DeviceTelemetry` kecil. Migration.
3. Tidak perlu test use-case untuk ini — smoke test manual cukup.
4. Commit: `feat(sync): piggyback device telemetry on push`.

### Step D3 — Manual verification (skenario §7.2 spec)

Build alpha, install di device user, monitor 3-7 hari:
- Skenario A: kill-restart loop.
- Skenario B: multi-device merge.

Cek dashboard server: apakah semua 4 anak dapat record? Kalau ya → shipping ke release. Kalau tidak → review telemetri, cari root cause baru di §4.6.

---

## Checklist ringkas (tracking)

Fase A:
- [x] A1 — Bug #1 test + fix + commit (`7c0f2f0`)
- [x] A2 — Bug #2 test + fix + commit (`ee45694`)
- [x] A3 — Bug #7 test + fix + commit (`1e7e3cd`)
- [ ] Alpha build + manual kill-restart verification (bagian dari D3)

Fase B:
- [x] B1 — Bug #8 fix + commit (`7d99b91`, derive totals from reward_history)
- [x] B2 — Bug #9 client fix (`32354e1`) + backend fix (`794976b`, accept `coin_spend`)
- [x] B3 — Bug #4 test + fix + commit (`c957311`)

Fase C:
- [x] C1 — Bug #3 test + fix + commit (`7707358`)
- [x] C2 — Bug #5 eliminated via test (`ed0a447`)
- [x] C3 — Bug #6 queue implementasi + test di `ee45694` (`syncChain` di `sync.ts`, test di `usecase-sync.test.ts:272`)
- [x] C4 — NetInfo listener + commit (`2d051a6`)
- [ ] ~~C5 — Background fetch~~ **DEFERRED** — trigger existing (mount, AppState, NetInfo reconnect, child-select, opportunistic push) dinilai cukup; Android 14+ background fetch tidak reliable (§9 Q3). Revisit kalau telemetri lapangan menunjukkan queue depth menumpuk.

Fase D:
- [x] D1 — TC integrasi lintas-bug (`389c5de`) + e2e backend harness (`5ceda8c`)
- [x] D2 — Telemetri piggyback client (`df3938e`) + backend upsert (`1f4de04`)
- [ ] D3 — Manual verification 3-7 hari (task user setelah ship)

---

## Stop conditions (kapan harus berhenti dan tanya user)

- **Test FAIL tapi hipotesis tidak jelas cara fix-nya** → tulis ringkasan di §4.6 spec, tanya user sebelum lanjut.
- **Fix butuh backend migration** (Bug #9 `coin_spend`) → konfirmasi user sebelum modif backend schema, karena akan deploy ke prod.
- **Butuh dep baru** (`expo-background-fetch`) → tanya dulu.
- **`npm test` full suite regresi** setelah fix → jangan commit, cari tahu kenapa.
- **Manual test alpha masih reproduce gejala** → stop, review §4.6 angles, tanya user.

---

## Referensi

- Spec: [spec.md](./spec.md) — semua skenario test, hasil observasi, dan root cause analysis.
- Workflow verifikasi: spec §4.5.
- Prinsip desain: spec §8.
- Angles alternatif kalau hipotesis gagal: spec §4.6.
- Memory feedback: [feedback_test_first](../../../.claude/projects/-home-ihf-Projects-ksatriamuslim-android/memory/feedback_test_first.md), [feedback_no_attribution](../../../.claude/projects/-home-ihf-Projects-ksatriamuslim-android/memory/feedback_no_attribution.md).
