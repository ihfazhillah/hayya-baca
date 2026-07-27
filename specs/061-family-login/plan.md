# Plan 061 — Login Keluarga (Family Lobby)

**Status:** Draft — menunggu approval
**Spec:** [spec.md](spec.md) (approved 2026-07-27)

Semua perubahan **frontend** (`diary-web/`). **Tidak ada perubahan backend**,
tidak ada migrasi. Deploy = `./deploy-diary.sh` (build + rsync statis).

Temuan dari kode existing yang menyetir plan:

- `SessionStore` sekarang menyimpan `{token, me, locked, lockedProfile}` tunggal,
  dengan persistence guardian di localStorage (fix #11). Diganti total.
- `SessionProvider` mengekspos `signInChild/signInGuardian/completeSetup/logout/lock`
  dan dua client: `api` (token aktif, `onUnauthorized: store.lock`) + `authApi`
  (no-op `onUnauthorized`, untuk endpoint login — fix #3). Pola ini dipertahankan.
- `App.tsx` route: `/setup` → `SetupPage`, sisanya → `AuthGate`.
- `GET /api/diary/me/` guardian sudah mengembalikan `children[]` dengan
  `id, name, avatar_color, has_diary_account, username`.
- Client (`api/client.ts`) memakai `getToken()` per-request → cukup swap token
  aktif tanpa membuat ulang client.

---

## 1. Model sesi (`auth/sessionStore.ts` — tulis ulang)

```ts
export const IDLE_MS = 10 * 60 * 1000
const FAMILY_KEY = 'ruangcerita.family'   // cache daftar anak, TANPA token

export interface FamilyChild {
  id: number
  name: string
  avatar_color: string
  username: string | null
  has_diary_account: boolean
}
export interface Family {
  guardianUsername: string
  children: FamilyChild[]
}

export type Active =
  | { kind: 'child'; token: string; me: MeChild }
  | { kind: 'guardian'; token: string; me: MeGuardian }
  | null

export interface SessionState {
  family: Family | null   // null → halaman Unlock; else → lobby tersedia
  active: Active          // null → Lobby; else → dalam profil
}
```

Tidak ada flag `locked` terpisah: **idle-lock = `active` di-null-kan** → lobby.

Method `SessionStore`:

```ts
getToken = () => this.active?.token ?? null      // client pakai token aktif
get state(): SessionState
unlock(guardianUsername: string, me: MeGuardian): void  // cache family, active=null, TIDAK simpan token
enterChild(me: MeChild, token: string): void            // active=child, arm idle
enterGuardian(me: MeGuardian, token: string): void       // active=guardian, refresh cache anak, arm idle
switchProfile(): void                                    // active=null → lobby (family utuh)
logout(): void                                           // family=null, active=null, hapus cache
lock = (): void                                          // idle/401: active=null → lobby
touch = (): void                                         // reset idle jika ada active
```

Persistence: hanya `family` (via `FAMILY_KEY`). `active`/token **tidak pernah**
dipersistkan. Konstruktor me-restore `family` dari localStorage (→ lobby).
Helper `toFamilyChildren(me: MeGuardian): FamilyChild[]` memetakan `me.children`.

## 2. `auth/SessionProvider.tsx` — tulis ulang API

```ts
interface SessionContextValue {
  state: SessionState
  api: Endpoints                                   // token aktif; onUnauthorized: store.lock
  unlock: (username, password) => Promise<void>     // login → me(guardian) → store.unlock (token dibuang)
  enterChild: (username, password) => Promise<void> // child-login → me(child) → store.enterChild
  enterGuardian: (password) => Promise<void>        // login(family.guardianUsername) → me → store.enterGuardian
  switchProfile: () => void
  logout: () => void
}
```

- `authApi` (no-op `onUnauthorized`) tetap dipakai untuk `login` & `child-login`
  supaya password salah = `ApiError` (bukan lock) — lanjutan fix #3.
- `bootstrap(token, expectRole)` sementara pakai client ber-token untuk ambil
  `/me/` (seperti sekarang), lalu commit ke store.
- `enterGuardian` memakai `state.family.guardianUsername` (dari cache) + password.

## 3. Client & token (`api/client.ts`)

Tanpa perubahan. `getToken()` sekarang mengembalikan token profil aktif; di
lobby (`active=null`) tidak ada panggilan API (lobby murni dari cache). 401 pada
profil aktif → `onUnauthorized` → `store.lock()` → kembali ke lobby.

## 4. Routing (`App.tsx`)

```tsx
function Gate() {
  const { state } = useSession()
  if (!state.family) return <LoginPage />       // Unlock orang tua
  if (!state.active) return <Lobby />           // Lobby profil
  return state.active.kind === 'child' ? <ChildApp /> : <GuardianApp />
}
// Routes: /setup → SetupPage (tetap), /* → Gate
```

`ChildApp`/`GuardianApp` tetap punya nested `<Routes>` sendiri (tidak berubah).

## 5. Layar

### 5.1 `routes/LoginPage.tsx` → Unlock orang tua (tulis ulang)
- Judul "Ruang Cerita", satu form: username + password → `unlock()`.
- Hapus tab Anak/Orang Tua.
- Simpan link kecil "Anak baru? Buat kata sandi" → `/setup` (jalur setup via kode
  tetap ada; pengecualian D2, lihat spec §7).
- Error inline dari `ApiError` (mis. "Username atau password salah", 429).

### 5.2 `features/lobby/Lobby.tsx` (baru)
- Ambil `state.family.children`, tampilkan tile anak `has_diary_account=true`
  (Avatar + nama) + tile **"Orang Tua"**. Anak tanpa akun → disabled + "Belum ada akun".
- Header: nama keluarga/greeting + tombol **"Keluar"** (`logout()`).
- State lokal `selected: {kind:'child', child} | {kind:'guardian'} | null`.
  Saat `selected` di-set → tampilkan **PasswordPrompt**; batal → kembali ke grid.

### 5.3 `features/lobby/PasswordPrompt.tsx` (baru, atau inline di Lobby)
- Kartu: avatar + nama target, input password (autofocus), tombol Masuk, error.
- Submit: `kind==='child'` → `enterChild(child.username, pw)`;
  `kind==='guardian'` → `enterGuardian(pw)`. Sukses → Gate re-render ke app.

### 5.4 Tombol "Ganti profil"
- `ChildApp` header (samping "Keluar") & `GuardianApp` `TopNav`:
  `onClick = () => { switchProfile(); navigate('/') }`.

## 6. Yang dihapus / diberhentikan

- `routes/LockScreen.tsx` — **dihapus** (digantikan lobby + PasswordPrompt).
- `auth/quickpick.ts` + test quickpick di `sessionStore.test.ts` — **dihapus**
  (digantikan family cache). Bersihkan semua import.
- Logika persist guardian (fix #11) di `sessionStore` — **dihapus** (diganti model
  family/active).
- `SetupPage.completeSetup`: tetap, tapi setelah sukses anak masuk `active=child`
  (bukan quick-pick). `SessionProvider.completeSetup` → `store.enterChild`.

## 7. Rencana test (test-first)

**`auth/sessionStore.test.ts` (tulis ulang):**
- `unlock` → `family` ter-cache, `getToken()===null`, `active===null`.
- reload (instance baru) → `family` restored, `active===null`, no token.
- `enterChild`/`enterGuardian` → `active` + token benar; idle timer jalan.
- idle timeout → `active===null`, `family` tetap.
- `switchProfile` → `active===null`, `family` tetap.
- `logout` → `family===null`, cache localStorage terhapus.
- token anak/orang tua **tidak pernah** ada di localStorage (dump assert).

**`routes/auth-flow.test.tsx` (perbarui journey):**
- Unlock (mock `login`+`me` guardian) → Lobby menampilkan anak + "Orang Tua".
- Tap tile anak → prompt → password → mock `child-login`+`me` child → ChildApp.
- Tap "Orang Tua" → prompt → password → GuardianApp.
- Password salah → error inline, tetap di lobby.
- Reload → kembali ke Lobby (bukan app), minta password lagi.
- Hapus test tab Anak/Orang Tua lama.

## 8. Urutan implementasi (→ tasks.md)

1. `sessionStore` model baru + tests.
2. `SessionProvider` API baru + wiring client.
3. `App.tsx` Gate + `LoginPage` unlock.
4. `Lobby` + `PasswordPrompt`.
5. Tombol "Ganti profil" (ChildApp, GuardianApp).
6. Hapus `LockScreen` + `quickpick`; update `completeSetup`.
7. Perbarui `auth-flow` tests; `tsc` + full suite hijau.
8. Deploy (`deploy-diary.sh`), smoke test di device.

## 9. Risiko & kompatibilitas

- Sesi/persist lama (`ruangcerita.session` #11, quick-pick) diabaikan; family
  cache dibangun ulang saat unlock berikutnya. Tak ada migrasi data.
- Perubahan menyentuh inti auth → dikerjakan test-first, commit bertahap,
  satu langkah satu commit.
- Idle-lock ke lobby berarti nama anak terlihat setelah idle (tanpa isi diari) —
  diterima untuk perangkat keluarga (Spec 060 shared-device).
