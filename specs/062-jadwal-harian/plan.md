# Plan 062 — Jadwal Harian Anak

**Status:** Draft — menunggu approval
**Spec:** [spec.md](spec.md) (approved 2026-07-27)

App Django **baru `schedule`** (terpisah dari `diary`, pakai `Child`/`ChildAccess`
yang sama). Frontend di `diary-web/`. **v1 tanpa reward/notifikasi.**

Temuan dari kode existing yang menyetir plan:

- `Child` (accounts) + `ChildAccess` (role parent/teacher) sudah ada; `is_child_account(user)`
  helper. Diary pakai `Child.user` OneToOne (`child_profile`) untuk akun anak.
- Permission siap pakai: `accounts.permissions.IsGuardianAccount`,
  `diary.permissions.IsChildAccount`. Cek "orang tua dari anak X" = `ChildAccess.objects
  .filter(user=..., child=..., role=PARENT).exists()` (pola `_is_parent_of` di accounts).
- Prod Postgres, tapi **test pytest pakai SQLite** (`config.settings.dev`) → **hindari
  `ArrayField`** (Postgres-only). Pakai `JSONField` (lintas-DB) untuk hari berulang.
- Test backend: pytest per-app (`schedule/tests.py`), use-case level.
- Frontend: same-origin `/api`, React Query, Vitest.

---

## 1. App baru `schedule`

- `backend/schedule/` (apps.py, models.py, serializers.py, views.py, urls.py,
  permissions.py, tests.py, migrations/).
- Daftarkan di `INSTALLED_APPS` (base settings). Mount URL di `config/urls.py`
  di bawah `/api/schedule/`.

## 2. Data model (`schedule/models.py`)

```python
class ScheduleTask(models.Model):
    class PartOfDay(models.TextChoices):
        PAGI = "pagi"; SIANG = "siang"; SORE = "sore"; MALAM = "malam"
    class Kind(models.TextChoices):
        ROUTINE = "routine"   # berulang
        ONCE = "once"         # sekali, satu tanggal

    child       = FK(Child, related_name="schedule_tasks")
    created_by  = FK(User)                 # anak atau orang tua
    title       = CharField(max_length=120)
    part_of_day = CharField(choices=PartOfDay)
    kind        = CharField(choices=Kind)
    repeat_days = JSONField(default=list)  # [0..6] (Senin=0) untuk ROUTINE
    date        = DateField(null=True)     # untuk ONCE
    emoji       = CharField(max_length=8, blank=True, default="")
    order       = PositiveIntegerField(default=0)  # urutan dalam bagian hari
    archived    = BooleanField(default=False)
    created_at  = DateTimeField(auto_now_add=True)

class TaskCompletion(models.Model):
    task         = FK(ScheduleTask, related_name="completions")
    date         = DateField()
    completed_at = DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ("task", "date")
```

- **Recurrence** disimpan sebagai `repeat_days` (list int 0–6). Default `[]` diisi
  `[0..6]` (tiap hari) di serializer jika ROUTINE tanpa pilihan.
- `created_by` → serializer mengekspos `from_guardian: bool` (=`not is_child_account`)
  supaya UI anak menandai tugas titipan orang tua.
- Ordering bagian hari: urutan tetap pagi→siang→sore→malam (konstanta), lalu `order`.

## 3. Logika "hari ini"

Untuk tanggal `D` (weekday `W`) milik anak `C`, tugas yang tampil:
- ROUTINE (tidak archived) dengan `W in repeat_days`, **atau**
- ONCE dengan `date == D`.

Tiap tugas + `done = TaskCompletion.objects.filter(task, date=D).exists()`.
Dikelompokkan per `part_of_day`. **Tanggal dikirim client** (tanggal lokal
perangkat) untuk hindari masalah timezone; default = hari ini server bila kosong.

## 4. API (`schedule/urls.py`, di bawah `/api/schedule/`)

**Anak (pemilik) — `IsChildAccount`, hanya `child_profile` sendiri:**
| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/schedule/today/?date=YYYY-MM-DD` | daftar hari ini (grup bagian hari + done + progres) |
| GET/POST | `/api/schedule/tasks/` | list semua tugas sendiri / buat tugas |
| PATCH/DELETE | `/api/schedule/tasks/<id>/` | ubah / hapus tugas sendiri |
| POST | `/api/schedule/tasks/<id>/toggle/` | body `{date, done}` → set/hapus completion |

**Orang tua — `IsGuardianAccount` + parent dari anak:**
| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/schedule/children/<child_id>/today/?date=` | lihat jadwal + progres anak |
| POST | `/api/schedule/children/<child_id>/tasks/` | tambah tugas untuk anak (`created_by`=ortu) |

Guard: anak hanya menyentuh `request.user.child_profile`; toggle hanya oleh anak
(orang tua tidak mencentang, D1). Orang tua wajib punya `ChildAccess` role parent
ke `child_id` (helper `is_parent_of(user, child_id)` di `schedule/permissions.py`).

`serializers.py`: `ScheduleTaskSerializer` (validasi: ROUTINE→`repeat_days` tak
kosong & 0–6; ONCE→`date` wajib), `TodayItemSerializer` (task + `done`).

## 5. Frontend (`diary-web/`)

- **Types** (`api/types.ts`): `PartOfDay`, `ScheduleKind`, `ScheduleTask`,
  `TodayTask` (`{...task, done}`), `TodaySchedule` (`{groups: {part, items}[],
  done_count, total}`).
- **Endpoints** (`api/endpoints.ts`): `scheduleToday(date)`, `scheduleTasks()`,
  `createScheduleTask(payload)`, `updateScheduleTask(id, payload)`,
  `deleteScheduleTask(id)`, `toggleScheduleTask(id, date, done)`,
  `childScheduleToday(childId, date)`, `addChildScheduleTask(childId, payload)`.
- **Sisi anak** (`features/child/`):
  - Navigasi: tambah nav kecil di `ChildApp` (Cerita | Jadwal) + route `/jadwal`.
  - `Schedule.tsx`: "Hari ini" grup pagi/siang/sore/malam, tiap item checkbox
    (optimistic toggle → invalidate `['schedule-today']`); progres "x/y selesai" +
    perayaan kecil saat semua selesai; tugas titipan ortu diberi ikon 👪.
  - `ScheduleEditor` (atau modal): tambah/ubah tugas — judul, bagian hari,
    rutin (pilih hari) / sekali (tanggal), hapus.
- **Sisi orang tua** (`features/guardian/`):
  - Di `Admin.tsx` (Kelola Anak) tiap anak: tombol "Jadwal" → `GuardianSchedule`
    (route `/jadwal/:childId`): lihat hari ini + progres, dan **tambah tugas**.

## 6. Rencana test (test-first)

**Backend (`schedule/tests.py`):**
- Model/recurrence: ROUTINE muncul di weekday yang cocok saja; ONCE muncul di
  tanggalnya saja.
- Anak buat tugas → muncul di `today`; toggle → `done` true; toggle lagi → false;
  riwayat: centang hari ini tak mengubah kemarin.
- Orang tua tambah tugas untuk anak (`from_guardian` true); orang tua **tidak**
  bisa toggle.
- **Isolasi**: anak A tak bisa lihat/toggle tugas anak B (404/403); orang tua tanpa
  ChildAccess parent → 403.
- Validasi: ROUTINE tanpa `repeat_days` valid → 400; ONCE tanpa `date` → 400.

**Frontend (`diary-web`, Vitest):**
- `Schedule` render grup + progres dari data mock; toggle memanggil endpoint.
- Use-case ringan (tidak menguji plumbing).

## 7. Urutan implementasi (→ tasks.md)

1. App `schedule` + `ScheduleTask`/`TaskCompletion` + migrasi + registrasi.
2. Serializer + logika "hari ini" + endpoint anak (today/CRUD/toggle) + tests.
3. Endpoint orang tua (view + add) + permission + tests.
4. FE types + endpoints.
5. FE anak: nav "Jadwal" + `Schedule` (today + toggle) + editor tugas.
6. FE orang tua: tombol "Jadwal" di Kelola Anak + `GuardianSchedule`.
7. `tsc` + vitest + pytest hijau.
8. Deploy (`deploy-diary.sh` — migrasi `schedule` ikut) + smoke test device.

## 8. Risiko & catatan

- **Migrasi**: app baru → migrasi awal; deploy jalankan `migrate` (deploy-diary.sh
  sudah source `.env` untuk Postgres prod).
- **Timezone**: tanggal dari client (lokal), server tak menebak.
- **`JSONField`** dipilih agar lintas SQLite(test)/Postgres(prod).
- Reward & notifikasi sengaja di luar v1 (Spec §6, §8).
