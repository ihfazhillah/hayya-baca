# Tasks 061 — Login Keluarga (Family Lobby)

**Status:** Selesai — deployed 2026-07-27
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) (approved 2026-07-27)

Aturan pengerjaan:

- **Test-first** (Vitest): tulis test yang FAIL dulu, baru implementasi.
- Satu task = satu commit (`feat(diary-web): T<n> <desc>` / `refactor(...)`).
- `npm run typecheck` + `npx vitest run` (diary-web) hijau di setiap commit.
- Semua perubahan di `diary-web/`. **Tidak ada perubahan backend / migrasi.**
- Checklist dicentang (`[x]`) saat task selesai.

---

## Fase 1 — Inti sesi

- [x] **T1 — Model `sessionStore` baru (`family` + `active`)**
  Tulis ulang `auth/sessionStore.ts` sesuai plan §1: state `{family, active}`,
  method `unlock/enterChild/enterGuardian/switchProfile/logout/lock/touch`,
  `getToken()` = token aktif. Persist HANYA `family` (tanpa token) ke
  `localStorage[ruangcerita.family]`; restore saat konstruksi.
  Tests (`sessionStore.test.ts`, tulis ulang):
  - `unlock` → `family` ter-cache, `getToken()===null`, `active===null`.
  - reload (instance baru) → `family` restored, `active===null`, no token.
  - `enterChild`/`enterGuardian` → `active` + token benar; idle timer jalan.
  - idle timeout → `active===null`, `family` tetap.
  - `switchProfile` → `active===null`, `family` tetap.
  - `logout` → `family===null`, storage terhapus.
  - token anak/orang tua TIDAK pernah ada di `localStorage` (dump assert).

## Fase 2 — Provider & client

- [x] **T2 — API `SessionProvider` baru**
  Ekspos `unlock/enterChild/enterGuardian/switchProfile/logout` (plan §2).
  `authApi` (no-op 401) untuk `login`/`child-login`; `bootstrap` ambil `/me/`
  dengan token sesaat lalu commit ke store. `enterGuardian` pakai
  `family.guardianUsername`. Client `api` token = token aktif; 401 → `store.lock`.

## Fase 3 — Routing & unlock

- [x] **T3 — `App.tsx` Gate + `LoginPage` unlock**
  `Gate`: `!family`→`LoginPage`, `!active`→`Lobby`, else `ChildApp/GuardianApp`
  (plan §4). `LoginPage` jadi form unlock orang tua saja (hapus tab
  Anak/Orang Tua); simpan link kecil "Anak baru? Buat kata sandi" → `/setup`.
  Error inline dari `ApiError`.

## Fase 4 — Lobby

- [x] **T4 — `Lobby` + `PasswordPrompt`**
  `features/lobby/Lobby.tsx`: tile anak (`has_diary_account`) + tile "Orang Tua"
  + tombol "Keluar"; anak tanpa akun disabled. State `selected` → tampilkan
  `PasswordPrompt` (avatar+nama, input password, error) → `enterChild`/
  `enterGuardian`. Tests (`auth-flow.test.tsx`, perbarui journey):
  - Unlock (mock `login`+`me` guardian) → Lobby: anak + "Orang Tua" tampil.
  - Tap anak → prompt → password → mock `child-login`+`me` → ChildApp.
  - Tap "Orang Tua" → prompt → password → GuardianApp.
  - Password salah → error inline, tetap di lobby.
  - Reload → kembali ke Lobby (bukan app).

## Fase 5 — Navigasi & pembersihan

- [x] **T5 — Tombol "Ganti profil"**
  Header `ChildApp` + `TopNav` `GuardianApp`: `switchProfile()` + `navigate('/')`.

- [x] **T6 — Hapus `LockScreen` + `quickpick`; `completeSetup` → `enterChild`**
  Hapus `routes/LockScreen.tsx`, `auth/quickpick.ts` + test quickpick lama;
  bersihkan import. `SessionProvider.completeSetup` commit sebagai `active=child`
  (bukan quick-pick). Setup via `/setup?code=` tetap masuk ChildApp langsung.

## Fase 6 — Verifikasi & rilis

- [x] **T7 — Suite hijau**
  `npm run typecheck` + `npx vitest run` hijau; `auth-flow` mencakup journey
  unlock → lobby → anak/ortu → ganti profil → reload.

- [x] **T8 — Deploy & smoke test**
  `./deploy-diary.sh`; verifikasi di device: unlock → lobby → masuk anak (password)
  → ganti profil → masuk orang tua (password) → reload kembali ke lobby;
  deep-link `/post/<id>` (notifikasi Telegram) tetap resolve lewat unlock → lobby.

---

## Catatan risiko

- Menyentuh inti auth → kerjakan berurutan, commit per task, jangan gabung fase.
- Sesi lama (`ruangcerita.session` #11, quick-pick) diabaikan; family cache
  dibangun ulang saat unlock. Tak ada migrasi.
- Idle-lock ke lobby: nama anak terlihat setelah idle (tanpa isi diari) —
  diterima untuk perangkat keluarga (Spec 060 shared-device).
