# Plan 072 — Tahsin Tracker

## Struktur

```
backend/tahsin/            app Django baru (INSTALLED_APPS + config/urls: path("api/tahsin/", include("tahsin.urls")))
  models.py                TahsinItem, Santri, TahsinRecord, TahsinScore
  serializers.py           + nested scores write (list of {item, value})
  permissions.py           resolve_role(user) → ("guardian"|"pengampu", santri|None)
  views.py                 MeView, ItemViewSet, SantriViewSet(+login-code actions), RecordViewSet(+bulk),
                           SummaryView, LoginCodeView (AllowAny)
  admin.py, urls.py, tests.py, migrations/
tahsin-web/                Vite + React 19 + TS + Tailwind 4 + vite-plugin-pwa (skeleton dari diary-web,
                           tanpa tanstack/tiptap; fetch + state lokal seperti english-web)
  src/api.ts               token storage (`tahsin.token`), request(), typed endpoints
  src/auth.tsx             AuthProvider {token, role, me, loginPassword, loginCode, logout}
  src/pages/Login.tsx      kode pengampu (auto-redeem ?code=) + username/password
  src/pages/Home.tsx       pengampu: kartu santri + tombol Input; guardian: shortcut Dashboard/Kelola/Cetak
  src/pages/BulkEntry.tsx  tabel tanggal × santri × aspek, ScorePicker 0–5, draft localStorage
  src/pages/SantriHistory.tsx  riwayat + edit/hapus record
  src/pages/Dashboard.tsx  filter pekan/bulan + pengampu, "perlu perhatian/bagus", heatmap santri×aspek
  src/pages/SantriDetail.tsx   trend per aspek (SVG sederhana) + tabel record
  src/pages/Manage.tsx     tab Aspek | Santri (+QR via qrcode.react) | Assignment
  src/pages/PrintForm.tsx  lembar harian A4 generik (@media print), route /print ; PrintQR.tsx route /print-qr
  src/components/ScorePicker.tsx, Heatmap.tsx, PeriodNav.tsx
  src/*.test.ts(x)         vitest: period helpers, draft store, ScorePicker, buildBulkPayload, ?code= redeem
deploy/tahsin.nginx.conf   dari ruangcerita.nginx.conf (root /home/ihfazh/tahsin-web/dist)
deploy-tahsin.sh           dari deploy-diary.sh (typecheck+test → build → rsync → migrate → restart)
```

## Backend — detail

**Role resolution** (`permissions.py`):
```
santri = Santri.objects.filter(user=user, is_pengampu=True, is_active=True).first()
if santri: role=pengampu, owner=santri.owner
elif is_child_account(user): 403
else: role=guardian, owner=user
```
Semua queryset di-scope `owner=<owner>`; pengampu tambah filter
`santri__pengampu=<santri>` (records/summary) atau `pengampu=<santri>` (santri list).
Pengampu tidak input record untuk dirinya sendiri (dinilai guardian).

**Auto-user untuk pengampu** (serializer/service):
- `is_pengampu` True & `user` None → `User(username=f"tahsin-{owner.id}-{slug(name)}[-n]")`,
  `set_unusable_password()`; `login_code = gen()` (SETUP_CODE_ALPHABET, 8 char).
- `is_pengampu` False → `login_code=None`, hapus DRF Token user tsb (User dibiarkan).
- Regenerate → kode baru + hapus Token.

**LoginCodeView** (`POST /api/tahsin/auth/login-code/`, AllowAny):
- lookup `Santri(login_code=code, is_pengampu=True, is_active=True)`; salah → 400 generik.
- Tanpa rate-limit (keputusan user: semua santri berbagi satu IP). Keamanan = entropi kode
  (31⁸). Kegagalan di-log (`logger.warning`) saja.
- Return `{token, name, role:"pengampu"}`.

**Records write**: nested `scores=[{item,value}]`; validasi item milik owner & aktif, value 0..5;
PATCH mengganti seluruh set scores (delete+recreate dalam transaction).
`bulk/`: `[{...record}]` → `transaction.atomic`, validasi semua dulu; error → 400 `{errors:{idx:{...}}}`.

**Summary** (`GET summary/?period=week|month&start=YYYY-MM-DD[&pengampu=][&santri=]`):
- range: week = start(Senin)..+6; month = tgl 1..akhir bulan; prev = periode sebelumnya.
- `TahsinScore.filter(record__owner, record__date__range[, record__santri__pengampu]).values("item")
  .annotate(avg, n)` current & prev → `items:[{id,code,name,avg,count,prev_avg}]`.
- per santri: `values("record__santri","item").annotate(avg)` + jumlah sesi + record terakhir →
  `santri:[{id,name,pengampu_id,sessions,last_date,last_page,last_page_detail,scores:{item_id:avg}}]`.
- Group-by di Python; data kecil (puluhan santri).

**Seed default items**: `POST items/seed/` (idempotent) membuat ns/t + mt; frontend tawarkan
tombol "Pakai aspek default" saat items kosong.

**Tests** (`tahsin/tests.py`, gaya english/tests.py):
- role guardian / pengampu / child-account 403; pengampu tidak lihat santri lain (404) & tidak bisa
  POST record santri lain (403).
- pengampu auto-user + login-code redeem → token; regenerate mencabut token lama.
- record CRUD, scores parsial, bulk atomic (satu error → tidak ada yang tersimpan).
- summary avg current vs prev, filter pengampu.
- edit/hapus record: pengampu hanya miliknya; guardian semua.

## Frontend — detail

- **period.ts**: `weekRange(date)` (Senin–Ahad), `monthRange`, `shift(±1)`, label
  "Pekan 33 · 11–17 Agu 2026" / "Agustus 2026". Unit-tested.
- **draft.ts**: key `tahsin.draft.<date>` → `{[santriId]:{page,page_detail,scores}}`;
  dihapus setelah submit sukses. Unit-tested.
- **BulkEntry**: baris per santri; nama sticky; ScorePicker = 6 tombol `–,0..5` (– = kosong).
  Submit hanya baris yang "tersentuh". Duplikat tanggal: cek `records/?from=&to=` → tandai baris
  "sudah ada catatan hari ini" (peringatan, tidak blokir). Offline → tombol "Simpan draft".
- **Dashboard**: PeriodNav (Pekan/Bulan, ‹ ›), select pengampu; kartu item avg + ▲▼ vs prev
  (threshold 0.25); Heatmap santri×item warna 0–5; klik santri → detail.
- **SantriDetail**: `records/?santri=&from=&to=` (default 3 bulan) → SVG polyline per item,
  tabel record + edit.
- **PrintForm** `/print?rows=15&days=1|2`: lembar harian generik (tidak terikat pengampu).
  `@page { size: A4 portrait; margin: 12mm }` (landscape bila aspek aktif > 12); header
  "Pengampu: ___ · Hari/Tanggal: ___"; tabel `No | Nama santri | Halaman | kode…` baris 10 mm;
  baris "Catatan"; footer keterangan kode + "skor 0–5, kosong = tidak dinilai"; days=2 → dua
  lembar identik (bolak-balik). Tombol Cetak hidden saat print.
- **PrintQR** `/print-qr?santri=<id>`: kartu QR + kode teks + URL.
- PWA manifest: name "Tahsin", theme teal `#0f766e`, ikon PNG 192/512/maskable (generate sekali,
  commit hasilnya seperti diary-web/public).

## Deploy

- `deploy/tahsin.nginx.conf` (server_name tahsin.ihfazh.com, root `/home/ihfazh/tahsin-web/dist`,
  `/api/` → sock, `/assets/` immutable, `/` no-store); certbot sekali manual.
- `backend/.env` `DJANGO_ALLOWED_HOSTS` += `tahsin.ihfazh.com` (manual di server; dicatat di script).
- `deploy-tahsin.sh` = deploy-diary.sh dengan path diganti.
- Setelah deploy pertama: tulis memory `tahsin-deploy`.

## Urutan kerja (tiap fase = commit terpisah, test-first)

1. Backend models + migrations + admin + role resolution + tests dasar.
2. Backend items/santri/login-code + tests.
3. Backend records (+bulk) + summary + tests.
4. Frontend skeleton (vite, pwa, auth, api, login termasuk ?code=).
5. Pengampu flow: Home, BulkEntry (+draft), SantriHistory.
6. Guardian: Manage (items/santri/assignment/QR), Dashboard, SantriDetail.
7. PrintForm + PrintQR.
8. Deploy assets, deploy, smoke test di HP.
