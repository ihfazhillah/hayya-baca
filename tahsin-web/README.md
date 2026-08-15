# Tahsin Tracker (`tahsin-web`)

PWA pencatatan perkembangan tahsin santri (Spec 072). Vite + React + Tailwind +
`vite-plugin-pwa`. Di-serve nginx pada `tahsin.ihfazh.com`; `/api/` di-proxy ke
gunicorn Hayya Baca yang sama (auth DRF token yang sama, tanpa CORS).

## Dev

```bash
npm install --legacy-peer-deps
npm run dev        # vite, proxy /api → localhost:8123 (backend dev runserver)
npm run typecheck
npm run test       # vitest (period, draft, login-code redeem)
npm run build
```

Backend (Django app `tahsin`, prefix `/api/tahsin/`): jalankan runserver di 8123
seperti biasa; endpoint `me/`, `items/`, `santri/`, `records/` (+`bulk/`),
`summary/`, `auth/login-code/`.

## Peran

- **Pengampu** — login via kode 8 huruf / scan QR (`/login?code=…`). Beranda →
  Input massal per tanggal → Riwayat/edit.
- **Guardian/ustadz** — login username+password. Dashboard (pekan/bulan,
  heatmap per pengampu) · Kelola (aspek/santri/pengampu + QR) · Cetak lembar
  harian. Menilai pengampu ad-hoc dari Detail santri (halaman opsional).

## Deploy

`./deploy-tahsin.sh` (dari root repo) — gating test → build → rsync dist →
git pull + migrate + restart gunicorn. Prereq one-time: nginx site + certbot
untuk `tahsin.ihfazh.com`, dan `DJANGO_ALLOWED_HOSTS` += `tahsin.ihfazh.com`.
