# Arsitektur Multi-Aplikasi (snapshot 2026-10-23)

Dokumen ini mencatat **kondisi sekarang**: ada beberapa aplikasi berbeda yang
memakai satu backend dan satu userspace. Ini bukan rencana. Arah perbaikan
ada di bagian terakhir dan baru dikerjakan setelah ada spec sendiri.

Detail domain Hayya Baca (sync, reward, guided reading) tetap ada di
[memory.md](memory.md).

## Gambaran besar

```
                    ┌──────────────────── server "ksatriamuslim" ────────────────────┐
 RN app (Android) ──┼─► hayyabaca.ihfazh.com/api ─┐                                  │
 diary-web        ──┼─► ruangcerita.ihfazh.com ───┤   nginx (1 site per subdomain)   │
 tahsin-web       ──┼─► tahsin.ihfazh.com ────────┼─► /api/ → unix:hayyabaca.sock    │
 english-web      ──┼─► english.ihfazh.com ───────┘        │                         │
                    │                                      ▼                         │
                    │              gunicorn hayyabaca.service (1 Django project)     │
                    │                                      │                         │
                    │                              1 DB PostgreSQL                   │
                    │                                                                │
                    │   workers: english-tts.service, english-youtube.service        │
                    │            english-mcp.service (port 8130, venv terpisah)      │
                    └────────────────────────────────────────────────────────────────┘
```

Bentuknya **modular monolith**: satu repo, satu Django project, satu DB, satu
proses web. Tiap aplikasi adalah satu Django app dan satu frontend sendiri.

## Daftar aplikasi

| Aplikasi | Frontend | Domain | Django app | Prefix API | Pengguna |
|---|---|---|---|---|---|
| Hayya Baca | RN/Expo (`app/`, `src/`) | APK, API di `hayyabaca.ihfazh.com` | `library`, `reading`, `rewards`, `games`, `sync`, `search`, `streaks` | `/api/`, `/api/children/<pk>/…`, `/api/search/` | Orang tua, anak (via profil Child) |
| Ruang Cerita (diary) | `diary-web/` | `ruangcerita.ihfazh.com` | `diary`, `schedule` | `/api/diary/`, `/api/schedule/` | Orang tua/guardian, anak (akun Child) |
| Tahsin | `tahsin-web/` | `tahsin.ihfazh.com` | `tahsin` | `/api/tahsin/` | Pemilik (User), pengampu (Santri + login code) |
| English Practice | `english-web/` | `english.ihfazh.com` | `english` | `/api/english/` | User (username + password) |
| Penerbit Rumah | `penerbit-web/` | `penerbit.ihfazh.com` | `penerbit` | `/api/penerbit/` | Anak (akun `Child`), orang tua (`ChildAccess` parent), Editor Tamu (User yang dibagikan naskah) |
| Nadzom (Spec 076) | `nadzom-web/` | `diwan.ihfazh.com` | – (statis, tanpa backend) | – | Pemilik sendiri, tanpa akun; progres hanya di localStorage |

Semua app dipasang di `backend/config/urls.py`.

## Userspace bersama (`accounts`)

Semua aplikasi memakai Django `User` dan auth DRF yang sama.

- **User**: dibuat lewat `/api/auth/register/`, login di `/api/auth/login/`
  (username + password). Hasilnya `Token` DRF.
- **Child**: profil anak. `created_by` mengarah ke User. Field `user`
  (OneToOne, opsional) diisi kalau anak punya akun login sendiri.
  `is_child_account(user)` membedakan akun anak dari guardian.
- **ChildAccess**: relasi User ↔ Child dengan role `parent` (maks 2) atau
  `teacher`. Dibagikan lewat share invite.
- Akun anak dibuat lewat `child-setup`/`child-login`: setup code 8 karakter
  yang berlaku 15 menit, dengan lockout bertahap.

Cara tiap aplikasi "menempel" ke identitas:

| App | Model kepemilikan | Identitas |
|---|---|---|
| reading/rewards/streaks | FK ke `Child` | Guardian lewat `ChildAccess` |
| diary, schedule | FK ke `Child` (+ `author`/`user` FK ke User) | Akun Child (`child_profile`) atau guardian |
| tahsin | FK langsung ke User (`owner`) | `Santri` = entitas sendiri. Pengampu dibuatkan User otomatis + `login_code` (`tahsin/services.py`) |
| english | FK langsung ke User | Tidak mengenal `Child` sama sekali |
| penerbit | FK ke `ProfilPenulis` (OneToOne `Child`) | Akun Child = Penulis; guardian lewat `ChildAccess` parent = Pemeriksa |

Dua hal yang perlu diperhatikan:
- **Ada dua konsep "anak/murid" yang berbeda**: `accounts.Child` dan
  `tahsin.Santri`. Keduanya tidak terhubung.
- **Ada tiga mekanisme login di luar password**: child-setup/child-login
  (accounts, dipakai diary), login-code (tahsin), dan family lobby
  (diary-web, di sisi client).

## Dependensi antar Django app

Hasil scan import non-test dan non-migration:

```
accounts  ◄── semua app (models, views, permissions, serializers)
library   ◄── reading, search, sync(seed_e2e), config/urls (quiz_manage)
reading   ──► games, rewards, library
rewards   ──► sync
search    ──► library, reading
accounts/admin ──► games, rewards        (arah terbalik, hanya di admin)
schedule/views ──► diary.permissions     (schedule bergantung ke diary)
english, tahsin, diary, penerbit ──► hanya accounts
```

Klaster yang terbentuk:
- **Inti**: `accounts`
- **Hayya Baca**: `library`, `reading`, `rewards`, `games`, `sync`, `search`, `streaks`
- **Ruang Cerita**: `diary`, `schedule`
- **Mandiri**: `english`, `tahsin`, `penerbit`

Belum ada aturan otomatis yang menjaga batas ini.

## Frontend web

Ketiga web app adalah proyek Vite + React 19 + react-router 7 + Tailwind yang
berdiri sendiri. Masing-masing punya `package.json` dan `node_modules` sendiri,
tanpa workspace atau shared package.

| | english-web | tahsin-web | diary-web |
|---|---|---|---|
| API client | `src/api.ts` (fetch) | `src/api.ts` (fetch) | `src/api/client.ts` + `endpoints.ts` + React Query |
| Auth | `src/auth.tsx` | `src/auth.tsx` | `src/auth/sessionStore.ts`, `SessionProvider.tsx` |
| Simpan token | `localStorage['english.token']` | `localStorage['tahsin.token']` | Token **tidak** dipersist; yang disimpan hanya `ruangcerita.family/guardian/trusted` |
| Login | password | password, login-code | password guardian, child-login, family lobby |
| PWA | – | vite-plugin-pwa | vite-plugin-pwa |
| Dev proxy | `/api` → `localhost:8123` | sama | sama |
| Test | vitest | vitest | vitest + oxlint |

Pola yang terduplikasi: `request()`, `ApiError`, header
`Authorization: Token`, handler 401, get/set token, dan AuthProvider.
english-web dan tahsin-web hampir identik.

Karena tiap app jalan di subdomain berbeda, localStorage-nya juga terpisah.
Akibatnya user yang sama harus **login terpisah di setiap app**. Tidak ada SSO.

## Backend: dependensi & proses

- Satu `backend/pyproject.toml` dengan dependency groups:
  `production`, `tts`, `stt`, `youtube`, `dev`. Semua group di-sync ke satu
  `.venv` di server. Perhatian: `deploy-english.sh` wajib menyertakan
  `--group production`, karena kalau tidak, `uv sync` ikut membuang
  dependensi production.
- Worker jangka panjang memakai management command `--loop` di bawah systemd:
  - `english-tts.service`: `generate_pending_audio`
  - `english-youtube.service`: `ingest_pending_youtube`
- `tools/english-mcp/` adalah server MCP dengan venv sendiri, di-proxy dari
  `english.ihfazh.com/mcp/`.
- Media: `backend/media/` dilayani nginx lewat `X-Accel` (`/protected-media/`,
  `/protected-english-media/`).

## Deploy

Ada satu script per aplikasi. Polanya sama: gate test → build frontend lokal →
rsync `dist/` → ssh (`git pull` → [`uv sync`, hanya english] → `migrate`) → restart
`hayyabaca.service` → reload nginx.

| Script | Gate test | Web root di server | Tambahan |
|---|---|---|---|
| `deploy-diary.sh` | frontend saja (typecheck + vitest) | `~/ruangcerita/dist` | – |
| `deploy-tahsin.sh` | `pytest tahsin/tests.py` + frontend | `~/tahsin-web/dist` | – |
| `deploy-english.sh` | `pytest english/tests.py` + frontend | `~/english-web/dist` | uv groups, install/restart worker |
| `deploy-penerbit.sh` | `pytest penerbit` + frontend | `~/penerbit-web/dist` | uv groups, `impor_course` |
| `deploy-nadzom.sh` | frontend saja (typecheck + vitest) | `~/nadzom-web/dist` | statis: tidak `git pull`, tidak `migrate`, tidak restart gunicorn |
| `build-release.sh` | `npm test` | APK + GitHub release | – |

Karena backend-nya satu, **deploy satu app ikut men-deploy backend untuk semua
app**: `git pull` mengambil semua perubahan di master, `migrate` menjalankan
semua migration, dan gunicorn di-restart. Gate test hanya mencakup app yang
sedang di-deploy. Selain itu `deploy-diary.sh`/`deploy-tahsin.sh` **tidak**
menjalankan `uv sync`, jadi kalau ada dependensi Python baru, kodenya bisa
ter-pull tanpa paketnya ikut terpasang.

Konfigurasi nginx dan systemd ada di `deploy/`. Pemasangannya (certbot,
enable site) masih manual sekali per app.

## Dev lokal

- Backend: port **8123** (`./scripts/test-local.sh`). E2E: port 8124.
- Web app: `npm run dev` di folder masing-masing. Vite mem-proxy `/api` ke 8123.
- Setiap web app butuh `npm ci` sendiri.

## Checklist: menambah aplikasi baru (kondisi saat ini)

Ini rangkuman langkah yang dilakukan english/tahsin/diary, supaya app baru
konsisten dengan yang sudah ada:

1. **Spec**: `specs/<NNN>-<app>/spec.md` → plan → tasks, masing-masing dengan approval.
2. **Django app**: `backend/<app>/`, tambahkan ke `INSTALLED_APPS`
   (`config/settings/base.py`), dan pasang URL dengan prefix `/api/<app>/` di
   `config/urls.py`.
3. **Identitas**: tentukan app ini menempel ke `User` (seperti english/tahsin)
   atau ke `Child` (seperti diary/schedule). Usahakan hanya import dari
   `accounts`, jangan dari app lain.
4. **Test backend**: `backend/<app>/tests.py` (pytest), dipakai sebagai gate di deploy.
5. **Frontend**: `<app>-web/` berbasis Vite (salin struktur dari `tahsin-web`
   yang paling ringkas), dev proxy `/api` → 8123, localStorage key dengan
   prefix `<app>.`.
6. **Infra**: `deploy/<app>.nginx.conf` (root `~/<app>-web/dist`, `/api/` →
   `unix:hayyabaca.sock`), certbot, tambahkan host ke
   `DJANGO_ALLOWED_HOSTS` di `backend/.env` server.
7. **Deploy**: `deploy-<app>.sh` (salin dari `deploy-tahsin.sh`). Kalau ada
   worker, tambahkan `deploy/<app>-*.service` dan dependency group di
   `pyproject.toml`, lalu pastikan semua group disebut di `uv sync`.

## Utang teknis yang diketahui

- Kode auth dan API client terduplikasi di tiga web app.
- Tidak ada SSO antar subdomain.
- `schedule` bergantung ke `diary.permissions`, dan `accounts/admin`
  bergantung ke `games`/`rewards`.
- Batas antar app belum dijaga otomatis (misalnya dengan import-linter).
- Tiga script deploy dengan logika yang hampir sama, tapi tidak konsisten
  (`uv sync` hanya ada di english, gate backend tidak ada di diary).
- `Child` dan `Santri` adalah dua model "anak" yang terpisah.

## Arah ke depan (belum diputuskan)

Ringkasan diskusi 2026-10-23: **tidak** dipecah jadi microservices karena
userspace-nya sama. Yang dipertimbangkan:
1. npm workspaces + `packages/api-client` dan `packages/auth` bersama.
2. import-linter untuk menjaga batas Django app.
3. Satu `deploy.sh <app>` dengan parameter.
4. SSO (cookie `.ihfazh.com`), hanya kalau banyak user memakai lebih dari satu app.

Masing-masing akan dibuatkan spec sendiri sebelum dikerjakan.
