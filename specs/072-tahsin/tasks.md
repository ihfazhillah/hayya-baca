# Tasks 072 — Tahsin Tracker

## Fase 1 — Backend inti
- [ ] `backend/tahsin/` app: models (TahsinItem, Santri, TahsinRecord, TahsinScore), migrations, admin
- [ ] INSTALLED_APPS + `path("api/tahsin/", ...)`
- [ ] `permissions.resolve_role`; `GET me/`
- [ ] tests: role guardian / pengampu / child-account 403

## Fase 2 — Items, Santri, login kode
- [ ] ItemViewSet (CRUD soft-delete, `seed/`)
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
- [ ] Home (kartu santri), BulkEntry (ScorePicker, draft, duplikat warning, submit bulk), SantriHistory (edit/hapus)
- [ ] tests: period.ts, draft.ts, buildBulkPayload

## Fase 6 — Guardian
- [ ] Manage: Aspek, Santri (+QR qrcode.react, regenerate), Assignment
- [ ] Dashboard (PeriodNav, kartu item, heatmap), SantriDetail (trend SVG + tabel)

## Fase 7 — Cetak
- [ ] PrintForm A4 (`/print`), PrintQR (`/print-qr`)

## Fase 8 — Deploy
- [ ] deploy/tahsin.nginx.conf, deploy-tahsin.sh, ALLOWED_HOSTS, certbot
- [ ] deploy + smoke test HP (install PWA, scan QR, input, dashboard, print)
- [ ] memory: tahsin deploy notes
