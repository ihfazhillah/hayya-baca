# Tasks 062 — Jadwal Harian Anak

**Status:** Draft — menunggu approval
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) (approved 2026-07-27)

Aturan pengerjaan:

- **Test-first**: tulis test yang FAIL dulu (pytest untuk backend, Vitest untuk FE),
  baru implementasi.
- Satu task = satu commit (`feat(schedule): T<n> …` / `feat(diary-web): …`).
- pytest + `npm run typecheck` + `npx vitest run` hijau di tiap commit.
- Checklist dicentang (`[x]`) saat selesai.

---

## Fase 1 — Fondasi backend

- [ ] **T1 — App `schedule` + model + registrasi**
  Buat app `backend/schedule/` dengan `ScheduleTask` + `TaskCompletion` (plan §2),
  daftar di `INSTALLED_APPS`, mount `/api/schedule/` di `config/urls.py`, migrasi awal.
  Test: buat task & completion; `unique_together(task,date)` ditegakkan.

- [ ] **T2 — Logika "hari ini" + endpoint anak**
  `ScheduleTaskSerializer` (validasi ROUTINE→`repeat_days` 0–6 tak kosong;
  ONCE→`date` wajib) + `from_guardian`. Endpoint `IsChildAccount`:
  `GET today`, `GET/POST tasks`, `PATCH/DELETE tasks/<id>`, `POST tasks/<id>/toggle`.
  Test: ROUTINE muncul hanya di weekday cocok; ONCE hanya di tanggalnya;
  toggle → done true; toggle lagi → false; centang hari ini tak ubah kemarin;
  validasi 400.

- [ ] **T3 — Endpoint orang tua + isolasi**
  `schedule/permissions.py` `is_parent_of`. `GET children/<id>/today`,
  `POST children/<id>/tasks` (`created_by`=ortu). Test: ortu tambah tugas
  (`from_guardian` true); ortu TIDAK bisa toggle; anak A tak bisa akses tugas anak B
  (403/404); ortu tanpa ChildAccess parent → 403.

## Fase 2 — Frontend anak

- [ ] **T4 — Types + endpoints FE**
  `api/types.ts`: `PartOfDay`, `ScheduleKind`, `ScheduleTask`, `TodayTask`,
  `TodaySchedule`. `api/endpoints.ts`: `scheduleToday`, `scheduleTasks`,
  `createScheduleTask`, `updateScheduleTask`, `deleteScheduleTask`,
  `toggleScheduleTask`, `childScheduleToday`, `addChildScheduleTask`.

- [ ] **T5 — Layar Jadwal anak + navigasi**
  Nav kecil di `ChildApp` (Cerita | Jadwal) + route `/jadwal`. `Schedule.tsx`:
  "Hari ini" grup pagi/siang/sore/malam + checkbox (toggle optimistic → invalidate
  `['schedule-today']`), progres "x/y selesai" + perayaan saat semua selesai,
  ikon 👪 untuk tugas titipan ortu. Test (Vitest): render grup + progres dari mock;
  toggle memanggil endpoint.

- [ ] **T6 — Editor tugas anak**
  Tambah/ubah/hapus tugas: judul, bagian hari, rutin (pilih hari) / sekali (tanggal).

## Fase 3 — Frontend orang tua

- [ ] **T7 — Jadwal sisi orang tua**
  Tombol "Jadwal" di `Admin.tsx` tiap anak → route `/jadwal/:childId`
  `GuardianSchedule`: lihat hari ini + progres anak, dan **tambah tugas**.

## Fase 4 — Verifikasi & rilis

- [ ] **T8 — Suite hijau + deploy**
  pytest + `tsc` + vitest hijau. `./deploy-diary.sh` (migrasi `schedule` ikut).
  Smoke test device: anak buat tugas rutin & sekali → centang → progres; orang tua
  tambah tugas & lihat progres; saudara tak bisa lihat jadwal anak lain.

---

## Catatan risiko

- App baru → migrasi awal; deploy jalankan `migrate` (deploy-diary.sh source `.env`).
- Tanggal dari client (timezone lokal), server tak menebak.
- `JSONField` agar lintas SQLite(test)/Postgres(prod).
- Reward & notifikasi di luar v1 (fase 2).
