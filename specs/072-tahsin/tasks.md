# Tasks 072 — Tahsin Tracker

Acuan: `spec.md` §6 (keputusan) + §7 (kesepakatan UI dari mockup), `plan.md`.
Tiap fase: test-first, satu commit per fase, minta approval sebelum fase berikutnya.

## Fase 1 — Backend inti
- [ ] `backend/tahsin/` app: models (TahsinItem, Santri, TahsinRecord, TahsinScore), migrations, admin
- [ ] INSTALLED_APPS + `path("api/tahsin/", ...)`
- [ ] `permissions.resolve_role`; `GET me/`
- [ ] tests: role guardian / pengampu / child-account 403

## Fase 2 — Items, Santri, login kode
- [ ] ItemViewSet (CRUD soft-delete, `seed/` = ns/t + mt)
- [ ] SantriViewSet (CRUD, `assign/`, auto-user + login_code, `login-code/`, `login-code/regenerate/`)
- [ ] `POST auth/login-code/` (tanpa rate-limit)
- [ ] tests

## Fase 3 — Records + Summary
- [ ] RecordViewSet (list filter, create nested scores, PATCH replace scores, delete, `bulk/`)
- [ ] SummaryView (week/month, prev, filter pengampu/santri)
- [ ] tests

## Fase 4 — Frontend skeleton
- [ ] `tahsin-web/` vite+react+tailwind+pwa, ikon, manifest
- [ ] api.ts, auth.tsx, Login (kode + password, auto `?code=`), routing, guard per role
- [ ] vitest setup + test login-code redeem

## Fase 5 — Pengampu
- [ ] Home (kartu santri + badge >5 hari), BulkEntry (centang kartu, Hal.+Keterangan, ScorePicker 7 tombol, draft, duplikat warning, submit bulk, offline → draft), SantriHistory (avg pekan ini vs lalu, list, edit/hapus), RecordForm (satu record + catatan + hapus)
- [ ] tests: period.ts, draft.ts, buildBulkPayload

## Fase 6 — Guardian
- [ ] Manage: Aspek (urutan, aktif/nonaktif), Santri (tambah cepat, jadikan pengampu), Pengampu/assignment (Pindahkan/Tetapkan), PengampuSheet (QR + kode + Ganti kode + Cetak kartu)
- [ ] Dashboard (PeriodNav, kartu perhatian/bagus, bar per aspek, heatmap per pengampu, ▲▼), SantriDetail (trend SVG per pekan + tabel + tambah/edit/hapus, page opsional)

## Fase 7 — Cetak
- [ ] PrintForm lembar harian A4 generik (`/print?rows=15&days=1|2`, landscape bila aspek > 12), PrintQR (`/print-qr?santri=`)

## Fase 8 — Deploy
- [ ] deploy/tahsin.nginx.conf, deploy-tahsin.sh, ALLOWED_HOSTS, certbot
- [ ] deploy + smoke test HP (install PWA, scan QR, input, dashboard, print)
- [ ] memory: tahsin deploy notes
