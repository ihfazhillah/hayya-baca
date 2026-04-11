# Spec 01 — Sync Problem: Reward/Progress Hilang di Multi-Device

**Status:** Draft — problem confirmation phase
**Author:** Ihfazhillah + Claude
**Date:** 2026-04-11
**Scope:** Keandalan sync Hayya Baca. **Offline-first tetap wajib.**

---

## 1. Laporan user (ground truth)

Laporan dari anak-anak langsung ke user:

> "Saya sudah membaca berulang kali, tapi koin masih 25 saja, tidak bertambah.
> Saya terakhir membaca hari Kamis yang lalu, tapi dalam dua pekan ini tidak
> ada laporan masuk ke server."

Gejala yang disebutkan:
- Reward/koin hilang atau tidak bertambah setelah sync.
- **"Koin naik sebentar, lalu kembali ke angka lama"** (rollback pattern).
- Progress buku tidak muncul di device lain.
- Sync gagal diam-diam (tanpa indikator ke user).
- Data tidak sampai ke server selama berhari-hari/berpekan-pekan.

Fakta lapangan terkonfirmasi (2026-04-11):
- Keluarga inti user: **4 anak terdaftar**.
- Dalam 2 pekan terakhir: **8 record di server, hanya untuk 2 anak**.
- Parent page **tidak pernah** dibuka dalam periode itu.
- **Semua 4 anak** merasakan gejala "koin naik lalu kembali ke angka lama",
  termasuk anak yang datanya tidak pernah masuk server.
- Upgrade app terakhir 2-3 pekan lalu.

Skenario dominan:
- **1 anak, 2+ device bergantian** (HP orang tua + tablet).
- **1 device, multi anak** (satu HP dipakai banyak anak).

Dampak bisnis: anak kehilangan motivasi karena reward tidak terasa ada.
Ini risiko adopsi produk, bukan sekadar bug kosmetik.

---

## 2. Arsitektur sync sekarang (as-is)

File relevan: `src/lib/sync.ts`, `src/lib/rewards.ts`, `src/lib/api.ts`,
`app/_layout.tsx`, `app/parent.tsx`.

### 2.1 Trigger sync

| # | Tempat | Kondisi | childIds? |
|---|---|---|---|
| 1 | `app/_layout.tsx:21` (mount) | Setiap kali app mount | **tanpa childIds** |
| 2 | `app/_layout.tsx:31` (AppState) | Hanya transisi `background\|inactive → active` | `[selectedChild.id]` jika ada |
| 3 | `app/parent.tsx:218,239` (manual) | Button "Sync" + login | semua anak |

### 2.2 Alur `syncAll(childIds?)` (sync.ts:35)

`syncChildren`:
1. Push unsynced children (profile).
2. **Untuk tiap `childId` di `childIds`** — push rewards, progress, reading_log.
3. Pull children list, upsert, hapus yang tidak di server.
4. **Untuk tiap `childId`** — pull reward_history, `recalculateBalance`.
5. **Untuk tiap `childId`** — pull reading_progress, `mergeServerReadingProgress` (LWW by `updated_at`).

**Catatan kritis:** step 2, 4, 5 hanya jalan **jika `childIds` non-empty**.

### 2.3 Model data

- `reward_history`: append-only + flag `synced` + `idempotency_key`.
  `addReward()` menulis baris + update `children.coins/stars` incremental.
- `reading_progress`: upsert by `(child_id, book_id)`, flag `synced`,
  `updated_at` timestamp. Push: kirim current state. Pull merge: LWW by
  `updated_at`.
- `reading_log`: append-only event selesai baca, `idempotency_key` per row.

---

## 3. Bug-bug yang sudah teridentifikasi dari kode

### Bug #1 — Sync data hanya jalan saat transisi background→active  ⚠️ HIGH

**Lokasi:** `app/_layout.tsx:28-36`

```ts
AppState.addEventListener("change", (nextState) => {
  if (appState.current.match(/inactive|background/) && nextState === "active") {
    syncAll(childId ? [childId] : undefined)...
  }
});
```

**Masalah:** Mount-sync (`syncAll()` tanpa childIds) **tidak pernah** push
data anak — step 2/4/5 di `syncChildren` skip. Push hanya terjadi lewat
trigger foreground transition. Kalau user (anak kecil) selalu kill app lalu
buka ulang, AppState tidak pernah melalui `background→active`:
start langsung di `active`. **Akibatnya: reward/progress lokal menumpuk
`synced=0` selamanya.**

Ini paling cocok dengan laporan "2 pekan tidak ada data masuk server".

### Bug #2 — Tidak ada sync setelah event  ⚠️ HIGH

**Lokasi:** `src/lib/rewards.ts:5` (`addReward`), `saveReadingProgress`.

`addReward` hanya menulis ke SQLite. Tidak trigger push. Kalau trigger
foreground tidak pernah jalan (Bug #1), tidak ada mekanisme kedua yang
mencoba mengosongkan queue.

### Bug #3 — Silent failure, user tidak tahu sync bermasalah  ⚠️ MEDIUM

**Lokasi:** `app/_layout.tsx:23,33`, `parent.tsx` display.

`.catch(() => {})` menelan error. `last_sync_status` disimpan ke `settings`
tapi hanya ditampilkan di Parent page (PIN-gated). Child UI tidak punya
indikator "data belum tersinkron / sync error / last sync X menit lalu".

### Bug #4 — LWW by `updated_at` bisa menimpa progress mundur  ⚠️ MEDIUM

**Lokasi:** `src/lib/rewards.ts:255-286` (`mergeServerReadingProgress`).

```ts
} else if (sp.updated_at > local.updated_at) {
  // Server is newer — update
  await db.runAsync(`UPDATE reading_progress SET ... completed_count = ?,...`)
}
```

Masalah:
- `completed_count` adalah **counter yang di-increment lokal** tiap selesai
  baca. Kalau dua device baca buku yang sama, LWW memilih satu
  `completed_count` saja — count dari device lain **hilang**.
- `last_page` juga bisa mundur kalau device A di halaman 12, device B di
  halaman 3 tapi `updated_at` lebih baru.
- Clock skew antar device memperparah: LWW by wall-clock tidak monotonic.

Efek potensial ke koin: kalau `completed_count` turun, UI child bisa
menampilkan progress lebih rendah dari yang dirasakan anak — "saya sudah
baca banyak kali kok tidak dihitung".

### Bug #5 — `recalculateBalance` overwrite `children.coins`  ⚠️ LOW-MEDIUM

**Lokasi:** `src/lib/rewards.ts:150`.

`addReward` increment `children.coins`. Setiap sync sukses,
`recalculateBalance` **menimpa** dari `SUM(reward_history)`. Jika pull
reward_history dari server mengembalikan data tidak lengkap (mis. filter,
paginasi, race condition), rekalkulasi bisa menurunkan saldo.

Saat ini kelihatannya aman (pull tanpa filter waktu), tapi fragile.

### Bug #6 — Race antar sync paralel partial-safe

`syncing` boolean guard memblok sync concurrent, tapi `syncAll` yang ter-skip
mengembalikan `skipped=true` diam-diam. Parent page tombol sync saat
`syncAll` background masih jalan → user menduga "sudah sync", padahal skip.

### Bug #7 — First-launch race: mount-sync tanpa selectedChild

Saat mount `_layout.tsx:21`, `getSelectedChild()` belum tentu ada (app
belum pernah pilih anak). Sync jalan tanpa childIds → cepat, tapi tidak
push. Setelah user pilih anak, tidak ada trigger sync baru sampai foreground
transition berikutnya.

### Bug #8 — Race `recalculateBalance` read-modify-write  ⚠️ HIGH (LOCAL, bukan sync)

**Lokasi:** `src/lib/rewards.ts:150-171`.

```ts
export async function recalculateBalance(childId) {
  const row = await db.getFirstAsync(
    `SELECT SUM(...) as coins, SUM(...) as stars FROM reward_history WHERE child_id = ?`,
    childId
  );
  const coins = row?.coins ?? 0;
  const stars = row?.stars ?? 0;
  // <-- GAP: event loop yield antara await SELECT dan await UPDATE
  await db.runAsync("UPDATE children SET coins = ?, stars = ? WHERE id = ?", coins, stars, childId);
}
```

Dua `await` berurutan tanpa transaction. Kalau `addReward` interleave di
gap, update `children.coins` oleh `recalculateBalance` menimpa update baru
dari `addReward` dengan nilai stale.

**Pola gejala yang cocok persis:** "koin naik sebentar, lalu kembali ke
angka lama". Anak melihat UI refresh 2x:
1. `addReward` → `emitDataChange("children")` → UI tampil angka baru.
2. `recalculateBalance` commit nilai stale → `emitDataChange` → UI tampil
   angka lama.

**Impact:** terjadi kapan pun `addReward` (anak selesai baca/kuis)
bersamaan dengan sync background yang memanggil `recalculateBalance`.
Frekuensi tinggi karena sync otomatis jalan sesering mungkin.

### Bug #9 — Game spending tidak dicatat ke `reward_history`  ⚠️ HIGH

**Lokasi:** `app/game/[gameId].tsx:79`, `src/lib/children.ts:112`.

```ts
// game/[gameId].tsx
await updateChildCoins(selectedChild.id, -found.coin_cost);

// children.ts
export async function updateChildCoins(childId, delta) {
  await db.runAsync("UPDATE children SET coins = coins + ? WHERE id = ?", delta, childId);
}
```

Komentar di `usecase-game.test.tsx:118`:
> `// SPY: updateChildCoins called to deduct coins locally (no reward_history entry)`

Ini **by design** — tapi interaksi dengan `recalculateBalance` bikin bug:

```
State awal: coins = 50, reward_history SUM = 50.
Anak beli game 5 coin:
  → updateChildCoins(-5) → children.coins = 45
  → reward_history SUM TETAP 50
Sync jalan → recalculateBalance:
  → SELECT SUM = 50
  → UPDATE children.coins = 50
  → coin yang dipakai beli game KEMBALI
```

Anak merasa "duit ajaib" atau sebaliknya "tadi beli game sukses, sekarang
kok coin balik lagi, terus game kelihatan belum dibeli" (tergantung
bagaimana game_sessions tracked). Ini **data inconsistency fundamental**:
`children.coins` dan `reward_history` adalah dua source of truth yang
berbeda, dan `recalculateBalance` **menang**.

**Impact:** setiap kali recalculateBalance jalan setelah game purchase,
pengurangan coin hilang. Frekuensi = frekuensi sync × anak yang main game.

Bug #8 dan #9 bisa terjadi bersamaan dan saling memperkuat gejala
"koin tidak stabil".

---

## 4. Hipotesis root cause "koin stuck 25, 2 pekan no data"

### 4.1 Data ground truth (update 2026-04-11, revisi 2)

User cek server: **dalam 2 pekan, tercatat 8 record, hanya untuk 2 dari 4
anak yang terdaftar**, dari device keluarga inti. Distribusi: **ngumpul di
beberapa titik waktu** (batch kecil), **anak yang masuk acak**.

**Fakta kritis tambahan: user TIDAK PERNAH membuka Parent page dalam 2
pekan ini.** Artinya `parent.tsx` manual sync **bukan** saluran yang
menghasilkan 8 record itu.

Proses eliminasi tinggal satu kandidat: AppState transition handler di
`_layout.tsx:31` yang pakai `syncAll([selectedChild.id])`.

### 4.2 Hipotesis yang ter-update

**H3 — PRIMARY ROOT CAUSE: `childIds = [selectedChild.id]` hanya push satu anak** ⚠️ CONFIRMED

`_layout.tsx:31`:
```ts
const childId = getSelectedChild()?.id;
syncAll(childId ? [childId] : undefined)
```

Hanya **satu** anak (selectedChild saat transisi terjadi) yang masuk ke
`syncChildren` step 2/4/5. Dalam 2 pekan, hanya 2 anak yang pernah jadi
selectedChild **pada saat** `background→active` transition **dan** network
tersedia. Dua anak lain tidak pernah dapat giliran → data mereka stuck
`synced=0` permanen.

Parent page saluran (`kids.map(c => c.id)`) sebenarnya benar — push semua
anak sekaligus — tapi user tidak pernah membuka. Jadi bug desain
`[selectedChild.id]` tidak pernah ter-kompensasi oleh manual sync.

**H1 (revisi) — AppState transition jarang terjadi**
Hanya 8 record / 2 pekan → transisi foreground sesekali jalan, tapi
sangat jarang. Pola anak kecil: kill-restart > minimize-resume. Kalau
transisi tidak pernah, nol record. Kalau rutin, ribuan record. Delapan =
kadang-kadang.

**H5 — Koin stuck dari perspektif anak**

Untuk 2 anak yang **ter-sync**: kemungkinan Bug #4 (LWW menimpa
`completed_count`/`last_page`) atau `recalculateBalance` (Bug #5) yang
over-correct saldo.

Untuk 2 anak yang **tidak pernah ter-sync**: step 4/5 di `syncChildren`
juga loop `childIds`, jadi tidak ke-pull. Aman dari overwrite. Koin
mereka murni lokal — seharusnya naik normal dari `addReward`. Kalau mereka
juga "stuck", bug-nya ada di flow reward lokal, bukan sync. **Ini harus
diverifikasi terpisah.**

### 4.3 Yang BUKAN masalahnya (dari data ini)

- Network atau login bukan issue utama — kalau iya, manual sync juga gagal.
- Idempotency tidak mencurigakan — tidak ada laporan duplicate.
- Backend menerima data dengan baik saat dikirim.

### 4.4 Implikasi untuk fix

Kabar baik: **fix-nya konvergen**. Tidak peduli H1/H3/H4/H5 mana yang
dominan, solusi yang sama menyelesaikan semua:

1. Automatic sync harus pakai pola `kids.map(c => c.id)` seperti Parent
   page, **bukan** `[selectedChild.id]`.
2. Trigger automatic harus berlapis (mount + NetInfo + opportunistic +
   background fetch), tidak bergantung AppState transition tunggal.
3. Counter conflict resolution (Bug #4) tetap harus dibereskan untuk
   case multi-device.

Urutan prioritas (berdasarkan impact tertinggi):
1. **Fix #1:** `_layout.tsx` → sync semua anak, bukan satu. 5 menit ngoding.
2. **Fix #2:** Opportunistic push di `addReward` / `saveReadingProgress`.
3. **Fix #3:** NetInfo reconnect listener.
4. **Fix #4:** Mount-sync pakai semua anak (tidak tunggu selectedChild).
5. **Fix #5:** Child UI indicator "belum sync (N)".
6. **Fix #6:** LWW → MAX untuk `last_page` dan `completed_count`.
7. **Fix #7:** Background fetch 15 menit.

---

## 4.5 Workflow verifikasi per hipotesis — WAJIB diikuti urut

Setiap bug yang disuspect harus melewati **siklus verifikasi 5 langkah**
sebelum boleh dianggap "fixed":

1. **Tulis test** yang reproduce bug (level use-case, pakai
   `better-sqlite3` + real logic seperti `integration-sync.test.ts`).
   Test ditulis dengan **asumsi bug benar** — harapan awal: FAIL.
2. **Jalankan** test, catat hasilnya di sub-section "Hasil observasi"
   masing-masing bug di spec ini. Dua kemungkinan:
   - **FAIL** sesuai hipotesis → hipotesis terkonfirmasi, lanjut fix.
   - **PASS** → hipotesis salah, tulis catatan "dieliminasi" +
     cari sudut lain (angles) di section "§4.6 Angles lain yang dicoba".
3. **Fix** bug di kode produksi. Jangan ubah test-nya.
4. **Jalankan ulang** test, pastikan PASS. Jalankan juga full suite
   (`npm test`) untuk memastikan tidak ada regresi.
5. **Commit** dengan pesan format:
   `fix(sync): <bug-id> <short description>` — satu commit per bug,
   test + fix bersama. Referensikan spec ini di body.

Prinsip:
- **Jangan fix sebelum test fail dulu.** Kalau test tidak fail, hipotesis
  salah dan fix-nya bisa salah sasaran.
- **Jangan skip test.** Test yang PASS terlalu cepat = bug-nya bukan yang
  kita duga.
- **Catat hasil nyata** di spec, bukan asumsi. Spec ini jadi log investigasi.
- Level use-case (sesuai
  [feedback_test_first](../../../.claude/projects/-home-ihf-Projects-ksatriamuslim-android/memory/feedback_test_first.md)),
  bukan unit test. File di `src/__tests__/usecase-*.test.{ts,tsx}`.

Template untuk tiap bug:

```
### Bug #N — <nama>

**Hipotesis:** <sebab diduga>
**Prediksi:** <apa yang akan terjadi — harus bisa dibalikkan jadi assertion>

**Test file:** `src/__tests__/usecase-<name>.test.ts`

**Test skenario (pseudocode):**
Given: <initial state>
When:  <action>
Then:  <expected — ini yang di-assert>

**Cara jalankan:** `npm test -- usecase-<name>`

**Hasil observasi (diisi saat test dijalankan):**
- [ ] Test ditulis
- [ ] Test dijalankan pertama kali
- Output: _________________________
- Status: ( ) FAIL sesuai hipotesis  ( ) PASS → hipotesis salah
- Catatan: _________________________

**Fix (isi setelah hipotesis terkonfirmasi):**
<lokasi file + perubahan>

**Verifikasi ulang:**
- [ ] Test yang sama PASS setelah fix
- [ ] `npm test` full suite PASS (tidak ada regresi)

**Commit:** `fix(sync): #N <short desc>`
```

---

### Bug #1 — Sync di mount tidak push data anak

**Hipotesis:** `_layout.tsx:21` mount-sync dijalankan tanpa `childIds`,
sehingga `syncChildren` step 2/4/5 skip. Data anak tidak pernah di-push
kecuali ada transisi `background→active`.

**Prediksi:** Setelah `addReward` + mount-sync (tanpa argumen), mock
`pushRewardsBulk` **tidak dipanggil**.

**Test file:** `src/__tests__/usecase-sync-mount-trigger.test.ts`

**Test skenario:**
```
Given: logged in, 4 anak terdaftar, tiap anak punya 1 reward synced=0
When:  syncAll()  // tanpa childIds, meniru mount sync
Then:  pushRewardsBulk TIDAK dipanggil untuk siapa pun
       (konfirmasi bug — harapan fix: dipanggil untuk semua 4 anak)
```

**Cara jalankan:** `npm test -- usecase-sync-mount-trigger`

**Hasil observasi:**
- [x] Test ditulis (`src/__tests__/usecase-sync-mount-trigger.test.ts`)
- [x] Test dijalankan pertama kali
- Output: `Expected number of calls: 4, Received number of calls: 0`
- Status: (x) FAIL sesuai hipotesis — konfirmasi: `pushRewardsBulk` 0 call saat `syncAll()` tanpa argumen.

**Fix:** `src/lib/sync.ts syncChildren` — kalau `childIds` undefined/empty,
auto-load semua child ID lokal via `SELECT id FROM children` sebelum
lanjut ke step 1. Satu titik fix, caller tidak bisa "lupa".

**Verifikasi ulang:**
- [x] Test yang sama PASS setelah fix
- [x] `npm test` full suite PASS (18 passed, 1 skipped — tidak ada regresi)

**Commit:** `fix(sync): #1 mount-sync now pushes all children`

---

### Bug #2 — `addReward` tidak trigger opportunistic push

**Hipotesis:** `rewards.ts:5` hanya insert ke DB. Tidak ada fire-and-forget
push. Kalau AppState trigger tidak jalan, queue menumpuk selamanya.

**Prediksi:** Setelah `addReward()` sukses, dalam 500ms `pushRewardsBulk`
tidak dipanggil sama sekali.

**Test file:** `src/__tests__/usecase-opportunistic-push.test.ts`

**Test skenario:**
```
Given: logged in, network up, 1 anak
When:  addReward(1, 'coin', 3, 'Baca buku 1')
       await delay(500)
Then:  pushRewardsBulk TIDAK dipanggil
       (harapan fix: dipanggil dengan reward tersebut, non-blocking)
```

**Cara jalankan:** `npm test -- usecase-opportunistic-push`

**Hasil observasi:**
- [x] Test ditulis (`src/__tests__/usecase-opportunistic-push.test.ts`)
- [x] Dijalankan pertama kali
- Output: `timeout waiting for mock call` — `pushRewardsBulk` dan `pushReadingProgress` tidak pernah dipanggil.
- Status: (x) FAIL sesuai hipotesis.

**Fix:**
1. `rewards.ts` — helper `triggerOpportunisticSync(childId)` fire-and-forget
   dengan lazy `require("./sync")` untuk hindari circular import. Dipanggil
   dari `addReward` dan `saveReadingProgress` setelah write sukses.
2. Karena opportunistic push otomatis memicu `syncAll` di background,
   semantic concurrent sync lama (silent-skip via flag `syncing`) membuat
   manual `syncAll` yang langsung dipanggil sesudahnya tertelan diam-diam.
   **Bug #6 fix dibawa maju** (Fase C → Fase A): ganti flag `syncing` dengan
   `syncChain: Promise` yang men-queue run. Dua test lama yang mengasumsikan
   skip-semantics (`usecase-sync.test.ts` "concurrent lock", `usecase-sync-reliable.test.ts`
   "Skenario 9") diupdate untuk mengakui semantic baru.

**Verifikasi ulang:**
- [x] Kedua test opportunistic PASS
- [x] `npm test` full suite PASS (19 passed, 1 skipped)

**Commit:** `fix(sync): #2 opportunistic push after addReward/saveReadingProgress`

---

### Bug #3 — Silent failure, user tidak tahu ada data belum sync

**Hipotesis:** Error sync dimakan `.catch(() => {})` di `_layout.tsx`.
Tidak ada indikator di UI anak. `last_sync_status` hanya terlihat di
Parent page (PIN-gated, jarang dibuka).

**Prediksi:** Kalau ada 5 unsynced rewards di DB, child screen tidak
menampilkan angka/badge apa pun yang menunjukkan ada data pending.

**Test file:** `src/__tests__/usecase-sync-indicator.test.tsx`

**Test skenario:**
```
Given: child screen mounted, 5 reward_history synced=0 untuk child aktif
When:  render
Then:  TIDAK ada elemen testID="sync-pending-badge"
       (harapan fix: ada badge dengan text "5" atau "belum sync")
```

**Cara jalankan:** `npm test -- usecase-sync-indicator`

**Hasil observasi:**
- [ ] Test ditulis
- [ ] Dijalankan pertama kali
- Output: _________________________
- Status: ( ) FAIL sesuai hipotesis  ( ) PASS → hipotesis salah

**Fix:** tambah hook `useUnsyncedCount(childId)` + badge component di
child screen header.

**Commit:** `fix(sync): #3 unsynced indicator on child screen`

---

### Bug #4 — LWW `mergeServerReadingProgress` menimpa counter mundur

**Hipotesis:** `rewards.ts:274` pakai `sp.updated_at > local.updated_at`
sebagai kriteria overwrite. Ini LWW timestamp dan bisa menurunkan
`last_page` atau `completed_count` kalau device lain updated_at lebih baru
tapi nilainya lebih kecil.

**Prediksi:** Local `last_page=12`, server `last_page=3` dengan
`updated_at` lebih baru → setelah merge, local `last_page` jadi 3.

**Test file:** `src/__tests__/usecase-progress-merge-counter.test.ts`

**Test skenario:**
```
Given: local reading_progress book="1" last_page=12, completed_count=3, updated_at="2026-04-01"
When:  mergeServerReadingProgress(1, [
         { book: "1", last_page: 3, completed: false, completed_count: 1, updated_at: "2026-04-10" }
       ])
Then:  local last_page == 3 dan completed_count == 1
       (konfirmasi bug — harapan fix: MAX, yaitu 12 dan 3)
```

**Cara jalankan:** `npm test -- usecase-progress-merge-counter`

**Hasil observasi:**
- [ ] Test ditulis
- [ ] Dijalankan pertama kali
- Output: _________________________
- Status: ( ) FAIL sesuai hipotesis  ( ) PASS → hipotesis salah

**Fix:** ganti LWW jadi `last_page = MAX(local, server)`, `completed_count
= MAX(local, server)`, `updated_at = MAX`. Jangka panjang: derive dari
`reading_log`.

**Commit:** `fix(sync): #4 merge reading_progress uses MAX for counters`

---

### Bug #5 — `recalculateBalance` overwrite dari history partial

**Hipotesis:** Kalau `fetchRewardHistory` return subset (pagination, filter
waktu, network partial), `mergeServerRewards` + `recalculateBalance`
**tidak** menurunkan coin (karena recalc sum dari LOCAL history, bukan
server response). Jadi hipotesis ini mungkin SALAH.

**Prediksi:** Kalau benar bug, `children.coins` turun setelah pull subset.
Kalau hipotesis salah, coin tetap.

**Test file:** `src/__tests__/usecase-recalculate-partial-pull.test.ts`

**Test skenario:**
```
Given: local reward_history punya 10 row, SUM=50. children.coins=50.
When:  fetchRewardHistory mock return 2 row saja (subset) → syncAll([1])
Then:  children.coins == 50  (TIDAK boleh turun)
```

**Cara jalankan:** `npm test -- usecase-recalculate-partial-pull`

**Hasil observasi:**
- [ ] Test ditulis
- [ ] Dijalankan pertama kali
- Output: _________________________
- Status: ( ) PASS → hipotesis salah, bug tidak ada  ( ) FAIL → bug ada

**Fix (kalau FAIL):** merge server rewards **sebelum** recalc; recalc
selalu pakai seluruh local reward_history.

**Commit:** `fix(sync): #5 recalculateBalance uses full local history`

---

### Bug #6 — Concurrent sync skip silent

**Hipotesis:** `syncing` guard di `sync.ts:37` me-return `skipped=true`
diam-diam. Tombol manual Parent page saat background sync jalan =
"tidak berfungsi" dari perspektif user.

**Prediksi:** `Promise.all([syncAll([1]), syncAll([1])])` → salah satunya
return `{skipped: true}` dan tidak melakukan apa pun.

**Test file:** `src/__tests__/usecase-sync-concurrent.test.ts`
(sebagian sudah ada di `usecase-sync.test.ts` line 280 — extend).

**Test skenario:**
```
Given: logged in, 1 reward unsynced
When:  const [r1, r2] = await Promise.all([syncAll([1]), syncAll([1])])
Then:  r1.skipped === true XOR r2.skipped === true
       (konfirmasi bug skipping — harapan fix: manual selalu dieksekusi,
        mungkin antri / queue)
```

**Cara jalankan:** `npm test -- usecase-sync-concurrent`

**Hasil observasi:**
- [ ] Test ditulis (atau extend existing)
- [ ] Dijalankan pertama kali
- Output: _________________________
- Status: ( ) FAIL sesuai hipotesis  ( ) PASS → hipotesis salah

**Fix:** ganti boolean guard dengan Promise chain — sync kedua `await`
sync pertama lalu run.

**Commit:** `fix(sync): #6 concurrent sync queues instead of skipping`

---

### Bug #7 — Mount-sync race first-launch

**Hipotesis:** Di `_layout.tsx:21`, `getSelectedChild()` return null saat
mount (session belum di-hydrate). Sync jalan tanpa childIds → skip push.
Setelah user pilih anak, tidak ada trigger baru sampai foreground
transition.

**Prediksi:** Setelah simulasi "pilih anak", `pushRewardsBulk` tidak
dipanggil untuk anak tersebut sampai AppState trigger.

**Test file:** `src/__tests__/usecase-sync-mount-race.test.ts`

**Test skenario:**
```
Given: app mount, session empty, 1 anak punya unsynced reward
When:  syncAll()  // mount, tanpa child
       lalu setSelectedChild(1)
       await delay(500)
Then:  pushRewardsBulk TIDAK dipanggil untuk anak 1
       (harapan fix: panggilan push terjadi setelah setSelectedChild)
```

**Cara jalankan:** `npm test -- usecase-sync-mount-race`

**Hasil observasi:**
- [x] Test ditulis (`src/__tests__/usecase-sync-mount-race.test.ts`)
- [x] Dijalankan pertama kali
- Output: `TypeError: sync.attachSessionSyncTrigger is not a function`
- Status: (x) FAIL — fungsi trigger belum ada. Sesudah implement → PASS.

**Fix:** `src/lib/sync.ts attachSessionSyncTrigger()` subscribe ke
`session.ts` listener. Trigger `syncAll([id])` saat active child berubah
(dedupe via `lastId`). Dipasang di `app/_layout.tsx` mount effect.

**Verifikasi ulang:**
- [x] Test PASS setelah fix
- [x] `npm test` full suite PASS (20 passed, 1 skipped)

**Commit:** `fix(sync): #7 sync triggers on child selection change`

---

### Bug #8 — Race `recalculateBalance` read-modify-write ⚠️ HIGH PRIORITY

**Hipotesis:** `rewards.ts:150-168` melakukan SELECT SUM lalu UPDATE di
dua `await` terpisah, tanpa transaction. `addReward` yang interleave di
gap akan ditimpa oleh UPDATE stale. Gejala: "koin naik lalu kembali ke
angka lama".

**Prediksi:** Eksekusi `addReward` bersamaan dengan `recalculateBalance`
bisa menghasilkan `children.coins` yang lebih kecil dari jumlah seharusnya.

**Test file:** `src/__tests__/usecase-recalculate-race.test.ts`

**Test skenario:**
```
Given: children.coins=25, reward_history SUM=25 (5 row x 5 coin)
When:  Jalankan 50x iterasi:
         await Promise.all([
           addReward(1, 'coin', 1, 'Baca'),
           recalculateBalance(1)
         ])
Then:  children.coins == 25 + 50 = 75
       reward_history row count == 55
       (konfirmasi race — harapan setelah fix: selalu == 75 konsisten)
```

**Catatan:** better-sqlite3 di-test environment mungkin sequential enough
untuk menyembunyikan race. Kalau PASS di test tapi user masih lihat di
lapangan, butuh angle tambahan (§4.6) — mungkin bukan race, tapi
urutan logic berbeda.

**Cara jalankan:** `npm test -- usecase-recalculate-race`

**Hasil observasi:**
- [ ] Test ditulis
- [ ] Dijalankan pertama kali
- Output: _________________________
- Status: ( ) FAIL sesuai hipotesis  ( ) PASS → hipotesis salah atau
  test environment tidak mereproduksi race

**Fix (kalau FAIL):** `db.withTransactionAsync(async () => { SELECT...
UPDATE... })` di `recalculateBalance`. Atau lebih baik: hapus
`recalculateBalance` sama sekali, `children.coins` jadi view dari
`SUM(reward_history)` yang di-query on-demand.

**Commit:** `fix(sync): #8 recalculateBalance wrapped in transaction`

---

### Bug #9 — Game spend tidak tercatat di `reward_history` ⚠️ HIGH PRIORITY

**Hipotesis:** `app/game/[gameId].tsx:79` memakai `updateChildCoins(-cost)`
yang hanya update `children.coins`, tidak tulis ke `reward_history`. Saat
`recalculateBalance` jalan (di sync step 4), SUM dari history "tidak
tahu" soal spend → coin yang dipakai beli game **kembali**.

**Prediksi:** Setelah beli game lalu `recalculateBalance`, `children.coins`
kembali ke nilai sebelum pembelian.

**Test file:** `src/__tests__/usecase-game-spend-persistence.test.ts`

**Test skenario:**
```
Given: children.coins=50, reward_history SUM=50 (10 row x 5 coin reward)
When:  updateChildCoins(1, -5)   // beli game seharga 5
       expect(children.coins).toBe(45)
       await recalculateBalance(1)
Then:  children.coins == 45  (HARAPAN SETELAH FIX)
       children.coins == 50  (KONFIRMASI BUG saat ini)
```

**Cara jalankan:** `npm test -- usecase-game-spend-persistence`

**Hasil observasi:**
- [ ] Test ditulis
- [ ] Dijalankan pertama kali
- Output: _________________________
- Status: ( ) FAIL sesuai hipotesis  ( ) PASS → hipotesis salah

**Fix:** ganti `updateChildCoins(-cost)` di `game/[gameId].tsx` dengan
`addReward(childId, 'coin_spend', -cost, 'Beli game: X')`. Pastikan
`recalculateBalance` SUM mengakomodasi `coin_spend`:
`SUM(CASE WHEN type IN ('coin','coin_adjustment','coin_spend') THEN count ELSE 0 END)`.
Juga: server-side perlu terima type `coin_spend` di push endpoint.

**Commit:** `fix(sync): #9 game spend persisted via reward_history`

---

### TC integrasi lintas-bug (dijalankan setelah semua fix)

**File:** `src/__tests__/usecase-full-reward-lifecycle.test.ts`

**Skenario:**
```
Device A:
  1. baca buku → addReward(1, 'coin', 3) → coins=3
  2. baca buku → addReward(1, 'coin', 2) → coins=5
  3. beli game 2 → coins=3 (setelah fix #9)
  4. syncAll([1]) → server terima 3 event (earn+earn+spend)
Device B (sync dari server):
  5. syncAll([1]) → pull → local coins=3
  6. addReward(1, 'coin', 1) → coins=4
  7. syncAll([1]) → push earn
Device A lagi:
  8. syncAll([1]) → pull → coins=4 (tanpa rollback, tanpa race)
```

**Cara jalankan:** `npm test -- usecase-full-reward-lifecycle`

**Hasil observasi:**
- [ ] Test ditulis (paling akhir, setelah semua fix selesai)
- [ ] Dijalankan
- Output: _________________________
- Status: ( ) PASS → integrasi sehat  ( ) FAIL → ada interaksi yang miss

---

## 4.6 Angles lain kalau hipotesis gagal

Kalau satu atau beberapa test di atas PASS (hipotesis salah), tulis di
section ini apa yang sudah dieliminasi, lalu brainstorm sudut baru:

- **Bug #8 tidak reproduce di test env?** better-sqlite3 sync; expo-sqlite
  async. Coba test dengan `setTimeout(0)` manual yield, atau test
  langsung di device dengan logging.
- **Bug #9 pass tapi user masih kena rollback?** Cek apakah ada jalur lain
  yang decrement children.coins tanpa history — grep `UPDATE children SET
  coins` lagi, audit `game_sessions` flow, audit migration scripts.
- **Semua bug lokal pass, masih "koin hilang"?** Kemungkinan bug ada di
  React Query cache atau state management UI — test hook/screen render
  lifecycle, bukan DB.
- **Multi-device data hilang padahal satu-device test pass?** Tambah test
  dengan dua instance DB paralel (device A + device B), pastikan state
  transfer benar via mock server.

Tiap hipotesis baru yang muncul di sini harus mengikuti workflow §4.5 yang
sama: test → run → hasil → fix → commit.

---

## 5. Research — pola offline-first sync yang robust (2026)

Ringkasan dari web search (sumber di §10):

### 5.1 Persisted outbox + idempotency key — **baseline wajib**

- Outbox di **SQLite** (bukan AsyncStorage), UNIQUE index di
  `idempotency_key`.
- Enqueue dalam transaksi yang sama dengan UI write → tidak mungkin "lupa
  enqueue".
- Server treat idempotency_key sebagai PK: `INSERT ... ON CONFLICT DO NOTHING`
  → duplicate retry aman.
- Status eksplisit: `queued | syncing | sent | failed | needs_review`
  (bukan binary `synced 0/1`).

**Kita sudah punya sebagian** (idempotency_key ada, flag synced ada), tapi
tidak ada status yang kaya dan tidak ada UNIQUE index server-side yang
eksplisit (perlu audit backend).

### 5.2 Retry dengan backoff + dead-letter

- Exponential backoff: 1s, 2s, 4s, ... max 5 menit.
- Jangan buang mutation yang gagal — tandai `needs_review` kalau retry lebih
  dari N kali.
- Pisahkan: network error (retry), auth error (pause, minta login),
  validation error (dead-letter, notifikasi ke user/ortu).

### 5.3 Trigger sync berlapis (defense in depth)

Jangan bergantung ke satu trigger. Pola umum:

1. **Segera setelah event** (opportunistic push) — coba push tiap addReward /
   saveReadingProgress, gagal ya masuk queue.
2. **On network reconnect** — listen `NetInfo.addEventListener('change')`,
   trigger flush saat `isConnected && isInternetReachable`.
3. **On app active** (baik mount maupun foreground transition, jangan
   hanya transition).
4. **Background periodik** — `expo-background-fetch` atau Headless JS, sync
   tiap ~15 menit saat app tidak aktif.
5. **Manual trigger** di Parent page (sudah ada).
6. **Idle timer** — jika app terbuka lama tanpa sync, auto-retry tiap 2 menit.

### 5.4 Conflict resolution untuk counter

Untuk `completed_count`, `coins`, `stars` — semuanya **counter**. Jangan
LWW. Pilihan:

- **Event-sourced (append-only)**: yang di-sync adalah event "read_completed",
  bukan state counter. Server SUM dari event. Ini yang sudah ada untuk
  `reward_history` dan `reading_log` — tinggal diterapkan konsisten ke
  `reading_progress.completed_count`.
- **CRDT counter (G-Counter / PN-Counter)**: per-device increment state
  `{deviceA: 3, deviceB: 2}` → merge = sum per device. Tidak perlu server
  yang cerdas, tapi state bloat.
- **State-based dengan `last_page = MAX(local, server)`**: untuk cursor
  "halaman terakhir" yang monotonic non-decreasing — pakai MAX, bukan LWW.

### 5.5 CRDT — kapan masuk akal?

**Pro:** mathematically correct, automatic merge, multi-device genuine.
**Kontra:** metadata bloat, lib Indonesia lokal terbatas (Yjs/Automerge
heavyweight), ekosistem RN+SQLite belum mulus, overkill untuk counter
sederhana.

Untuk Hayya Baca: counter reward + cursor progress + append log =
**event-sourced sudah cukup**. CRDT adalah nuklir untuk masalah palu-dan-paku.
Pertimbangkan CRDT hanya jika nanti ada fitur kolaboratif real-time
(mis. dua anak main game yang sama bareng).

---

## 6. Options — arsitektur target (pros/cons)

Dua pendekatan besar sesuai prioritas user ("Reliability dulu" + "Arsitektur
ulang"):

### Option A — Reliability-first (incremental fix)

**Ide:** Perbaiki bug yang ada tanpa mengubah model data besar. Fokus:
trigger berlapis, outbox lebih kuat, status sync visible, LWW→MAX/event.

**Perubahan konkret:**
1. Hapus guard `background→active` — sync jalan **juga di mount** dan
   **push semua anak** (load child IDs dari DB lokal, bukan cuma
   `selectedChild?.id`). Sejalan dengan root cause H3 di §4.2.
2. Tambah NetInfo listener → flush queue saat online.
3. Opportunistic push di `addReward` / `saveReadingProgress` (fire-and-forget,
   tidak blok UI).
4. Background fetch tiap ~15 menit.
5. Ganti `mergeServerReadingProgress` dari LWW → `last_page = MAX`,
   `completed_count = MAX` (atau event-source dari `reading_log`).
6. UI indicator di child screen: "belum tersinkron (N item)" + tombol retry
   manual.
7. Telemetri ringan: count `pending_rewards`, `last_successful_sync_at`,
   `last_sync_error`, `device_id` — kirim dengan setiap push.
8. Error reporting ke Sentry / custom endpoint.

**Pros:**
- Risiko rendah, tidak menyentuh model data.
- Bisa ship bertahap, setiap langkah measurable.
- Cocok dengan kapasitas solo dev.
- Langsung menyelesaikan Bug #1, #2, #3 (root cause utama).

**Cons:**
- Bug #4 (LWW counter) butuh desain ulang `mergeServerReadingProgress`
  walaupun tidak besar.
- Tidak menghilangkan **semua** kelas race condition — hanya yang kita tahu.
- Kalau ternyata di masa depan butuh collaborative (dua device edit bareng),
  harus refactor lagi.

**Effort estimate:** 3-5 hari ngoding + 2 hari testing + 1 hari instrument.

---

### Option B — Event-sourced rewrite

**Ide:** Semua perubahan direpresentasikan sebagai event immutable di log
lokal. State (coins, completed_count, last_page) di-derive dari event.
Server hanya relay log. Push = append event. Pull = `GET /events?since=X`.

**Schema baru:**

```
event_log:
  id (local autoincrement)
  device_id
  event_id (uuid, globally unique)   ← idempotency key
  child_id
  type (read_page | read_complete | reward_earn | reward_spend | ...)
  payload (json)
  created_at (device clock)
  server_seq (nullable, ascending after server ack)

device_cursor:
  device_id → last_server_seq_pulled
```

State `coins`, `reading_progress` menjadi **view materialized** dari
event_log (rebuild di client saat startup atau incremental).

**Pros:**
- Tidak ada masalah "state hilang" — source of truth adalah append-only log
  yang mudah di-rekonstruksi.
- Konflik hilang secara struktural untuk counter (semua jadi sum of events).
- Audit trail gratis (bagus untuk debugging laporan anak).
- Multi-device merge benar by construction.
- Replay gampang — tinggal rebuild view dari log.
- Dead-letter / needs_review jadi natural: event gagal apply ditandai.

**Cons:**
- Rewrite besar: rewards, progress, children coin balance, parent dashboard,
  semua jadi view bukan state.
- Server juga harus ubah — schema + endpoint `/events` dengan seq monotonic
  per child. Backend Django migration non-trivial.
- Testing: semua use-case test yang sudah ada (55 test) harus dirombak.
- State bloat: event log bisa besar untuk anak yang rajin — perlu
  snapshot + compaction.
- Risiko regresi tinggi, timing ship lama.
- Dev harus paham event sourcing — learning curve.

**Effort estimate:** 2-3 minggu ngoding + 1 minggu testing + 1 minggu
migration + instrumentasi.

---

### Option C — Hybrid: Reliability-first sekarang, event-sourced nanti

Kerjakan Option A lebih dulu (ship dalam ~1 pekan). Sambil jalan, pasang
telemetri rich. Setelah 2-3 pekan data telemetri, evaluasi: apakah masih ada
kelas bug yang tidak bisa di-fix tanpa event sourcing? Kalau ya, baru
invest ke Option B dengan data nyata.

**Rekomendasi:** **Option C.** Alasan:
1. User butuh fix **cepat** — anak-anak sudah kehilangan motivasi.
2. Root cause utama (Bug #1, #2) tidak butuh CRDT/event sourcing — cukup
   perbaiki trigger sync.
3. Tanpa telemetri, rewrite arsitektur adalah tebakan mahal.
4. Option A menyediakan fondasi (idempotency, outbox, status) yang sama-
   sama dibutuhkan Option B — kerja tidak terbuang.

---

## 7. Verifikasi problem — harus dilakukan SEBELUM commit ke arsitektur

Kita **belum tahu pasti** sumber laporan "koin 25". Sebelum rewrite apa
pun, kumpulkan data.

### 7.1 Telemetri minimal (ship hari ini)

Tambah endpoint `/api/telemetry/sync-status` atau piggyback ke push yang
sudah ada:

```json
{
  "device_id": "...",
  "child_id": 1,
  "queue_depth_rewards": 12,
  "queue_depth_progress": 3,
  "queue_depth_reading_log": 8,
  "last_successful_sync_at": "2026-04-04T...",
  "last_sync_error": "Network request timed out",
  "app_version": "1.0.7",
  "local_coins": 42,
  "local_completed_counts": {"1": 3, "2": 1}
}
```

Kirim setiap kali app mount + tiap sync selesai.

**Setelah 3-7 hari data, kita akan tahu:**
- Apakah sync benar-benar tidak jalan (queue_depth tumbuh terus, last_sync_at
  makin tua) → konfirmasi Bug #1.
- Atau sync jalan tapi push gagal (last_sync_error berisi) → bug lain.
- Atau sync jalan dan push sukses, tapi state server beda dari state lokal
  → konfirmasi Bug #4 / merge bug.

### 7.2 Langkah reproduksi manual

Dua skenario test user:

**Skenario A — Kill-restart loop (H1):**
1. Install app fresh, login, pilih anak.
2. Baca 1 buku sampai selesai → coin bertambah.
3. **Force stop** app (swipe dari recent).
4. Buka lagi → cek apakah sync jalan atau tidak (monitor network tab).
5. Ulang 3x.
6. Cek dashboard server: berapa reward masuk?

**Skenario B — Multi-device (H2):**
1. Device A: baca buku 1 sampai halaman 5.
2. Device A: sync.
3. Device B: baca buku 1 sampai halaman 3.
4. Device B: sync.
5. Device A: sync lagi.
6. Cek: `last_page` dan `completed_count` di device A setelah sync terakhir.

### 7.3 Tambah logging di trigger sync

Sebelum instrumentasi fancy, tambah `console.warn` di:
- `_layout.tsx` — log AppState.currentState tiap perubahan + trigger sync.
- `sync.ts` — log `childIds`, `queue_depth`, hasil tiap step.

Kumpulkan log dari 2-3 device user untuk 3 hari → kita akan tahu persis
di jalur mana data hilang.

---

## 8. Prinsip desain yang harus dipegang

1. **Offline-first non-negotiable.** Semua operasi harus sukses tanpa
   internet. Sync adalah best-effort di background.
2. **Counter jangan di-LWW.** Counter adalah event sum, bukan state
   snapshot.
3. **Satu trigger saja rapuh.** Harus berlapis: event, mount, reconnect,
   background, manual.
4. **Kegagalan harus visible.** User (atau minimal orang tua) harus tahu
   data belum tersinkron. Badge, warna, angka — sesuatu.
5. **Idempotency bukan opsi.** Setiap mutation punya UUID, server dedupe.
6. **Jangan ganti arsitektur tanpa data.** Telemetri dulu, rewrite kemudian.
7. **Test tetap level use-case.** Jangan turunkan ke unit test implementasi
   (sesuai feedback_test_first). Contoh use-case:
   "Anak selesai baca 3 buku offline, lalu app di-kill-restart, lalu online
   — semua 3 reward sampai di server."

---

## 9. Open questions (untuk didiskusikan)

1. Apakah backend Django saat ini sudah enforce UNIQUE(device_id,
   idempotency_key)? Kalau belum, bisa terjadi duplicate server-side saat
   dua device kebetulan pakai key sama. (Saat ini key = `deviceId:localId`
   jadi seharusnya unik — tapi perlu audit index.)
2. Berapa device rata-rata per anak di user base saat ini? 1? 2? 3+?
   Menentukan seberapa aggressive kita butuh conflict handling.
3. Apakah ada constraint battery/data usage yang membatasi background sync?
   expo-background-fetch tidak selalu reliable di Android 14+.
4. Parent dashboard: apakah tampilkan state terakhir, atau event history?
   Menentukan apakah Option B worth it.
5. Budget waktu: berapa lama user bisa menunggu fix? Kalau minggu ini harus
   ship, Option A saja. Kalau bisa 1 bulan, Option C.

---

## 10. Sumber research

- [Offline-First Mobile App in 2026: Real-Time Data Sync with CRDT Architecture — Calibraint](https://www.calibraint.com/blog/offline-first-mobile-app-in-2026)
- [The Hidden Problems of Offline-First Sync: Idempotency, Retry Storms, and Dead Letters — dev.to](https://dev.to/salazarismo/the-hidden-problems-of-offline-first-sync-idempotency-retry-storms-and-dead-letters-1no8)
- [React Native offline sync with SQLite queue — dev.to](https://dev.to/sathish_daggula/react-native-offline-sync-with-sqlite-queue-4975)
- [The Cascading Complexity of Offline-First Sync: Why CRDTs Alone Aren't Enough — dev.to](https://dev.to/biozal/the-cascading-complexity-of-offline-first-sync-why-crdts-alone-arent-enough-2gf)
- [Offline sync & conflict resolution patterns — Sachith Dassanayake](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-crash-course-practical-guide-apr-8-2026/)
- [Building offline-first apps using event-sourcing — flpvsk](https://flpvsk.com/blog/2019-07-20-offline-first-apps-event-sourcing/)
- [Build an offline-first app — Android Developers](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [A Design Guide for Building Offline First Apps — Hasura](https://hasura.io/blog/design-guide-to-offline-first-apps)
- [Event Sourcing Pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Idempotent Command Handling — event-driven.io](https://event-driven.io/en/idempotent_command_handling/)

---

## 11. Next actions (proposed)

**Minggu ini (blocker fix):**
- [ ] Tambah logging `console.warn` di sync trigger + hasil sync.
- [ ] Fix Bug #1: mount-sync & AppState trigger harus push **semua anak**
      (load child IDs dari DB lokal), bukan `[selectedChild.id]`. Ini
      langsung menangani H3 root cause — lihat §4.4 Fix #1.
- [ ] Fix Bug #2: opportunistic push fire-and-forget di `addReward` +
      `saveReadingProgress`.
- [ ] Fix Bug #7: trigger sync saat `setSelectedChild` dipanggil (event
      listener), untuk menutup race first-launch.
- [ ] Fix Bug #3: child UI indicator "belum sync (N)".
- [ ] NetInfo listener → flush on reconnect.

**Pekan depan:**
- [ ] Telemetri endpoint + piggyback data.
- [ ] Ganti LWW `mergeServerReadingProgress` → MAX untuk last_page &
      completed_count (atau derive dari reading_log).
- [ ] Background fetch 15 menit.
- [ ] Use-case test tambahan: kill-restart loop, multi-device MAX merge.

**Setelah 2 pekan data telemetri:**
- [ ] Review: apakah Option B masih perlu? Kalau iya, spec terpisah.
