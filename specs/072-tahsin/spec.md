# Spec 072 — Tahsin Tracker (PWA pencatatan perkembangan tahsin santri)

**Status:** Deployed 2026-08-15 → https://tahsin.ihfazh.com (backend `tahsin` + `tahsin-web`). Mockup: artifact "Tahsin Tracker Mockup".
**Tanggal:** 2026-08-15
**Produk:** Aplikasi web terpisah (PWA) `tahsin-web/` + backend app `backend/tahsin/`
**Pola:** Sama seperti Ruang Cerita (Spec 060) dan English (Spec 064): SPA Vite +
React + Tailwind + `vite-plugin-pwa`, di-serve nginx pada domain sendiri,
`/api/` di-proxy ke gunicorn Hayya Baca yang sama (auth DRF token yang sama).

## 1. Konteks & masalah

Ustadz/guardian membina halaqah tahsin. Setiap sesi, bacaan santri dinilai per
aspek tajwid (nun sukun/tanwin, mad thobi'i, dst.) dengan skor 0–5, plus
halaman Al-Qur'an yang dibaca. Santri terbagi dua: **pengampu** (santri senior
yang juga menilai santri lain) dan **santri biasa**. Pencatatan hari ini di
kertas; guardian ingin rekap digital yang bisa difilter per pekan/bulan untuk
melihat aspek mana yang masih lemah dan mana yang sudah bagus, per santri
maupun keseluruhan.

Kebutuhan pengampu: **semudah mungkin** — login sekali di HP, lalu memindahkan
rekap kertas ke aplikasi di waktu senggang (bukan realtime saat menyimak).

## 2. Aktor & peran

| Aktor | Akun | Yang bisa dilakukan |
|---|---|---|
| **Guardian / ustadz** | Django `User` yang sudah ada (login username + password) | Kelola aspek penilaian, santri, pengampu, assignment pengampu→santri; input/edit **semua** record; dashboard & detail; cetak form A4 |
| **Pengampu** | Django `User` yang dibuat **otomatis** saat guardian menandai santri sebagai pengampu (username `tahsin-<id>-<slug>`, password unusable), ter-link ke `Santri.user` | Login dengan **scan QR permanen** (atau ketik kode 8 huruf yang sama) — tanpa username/password; lihat santri ampuannya; input/edit record **hanya** untuk santri ampuannya; lihat riwayat santri ampuannya |
| **Santri biasa** | tidak punya akun | — (hanya dinilai) |

Catatan:
- Pengampu **juga santri**: ia punya baris `Santri` sendiri dan bisa dinilai
  (oleh guardian, atau oleh pengampu lain kalau di-assign).
- Peran ditentukan saat login lewat `GET /api/tahsin/me/`:
  - user punya `Santri` dengan `user=me` → **pengampu**;
  - selain itu (bukan child-account Ruang Cerita) → **guardian**;
  - child-account Ruang Cerita tanpa profil pengampu → 403.
- v1 **single-owner**: semua data (aspek, santri, record) punya `owner`
  (guardian yang membuat). Berbagi antar-guardian (mis. ustadz lain) di luar
  scope; model sudah pakai `owner` supaya bisa ditambah `TahsinAccess` nanti.

## 3. Model data

```
TahsinItem        — aspek yang dinilai
  owner FK User, name "Nun sukun / tanwin", code "ns/t", order int,
  is_active bool (nonaktif ≠ hapus, riwayat skor tetap ada), created_at

Santri
  owner FK User, name, is_pengampu bool,
  user OneToOne User null (hanya untuk pengampu yang punya login),
  pengampu FK Santri null (self-FK; santri biasa → pengampu-nya. 1 pengampu : m santri),
  is_active bool, notes text blank, created_at

TahsinRecord      — satu sesi bacaan
  owner FK User (guardian pemilik data), santri FK Santri,
  date Date, page PositiveSmallInt null, page_detail Char(120) blank
      (contoh: page=45, page_detail="ayat 3–10" / "seperempat pertama"; boleh
       page kosong tapi page_detail terisi, mis. "Iqro 4 hal 12"),
  notes text blank,
  created_by FK User (siapa yang input: pengampu / guardian),
  created_at, updated_at

TahsinScore       — skor per aspek per record
  record FK, item FK TahsinItem, value SmallInt 0..5
  unique (record, item). Aspek yang tidak dinilai hari itu = tidak ada baris
  (bukan 0). Skor selalu disimpan per-baris (bukan JSON) supaya agregasi
  per pekan/bulan bisa pakai query DB biasa.

Santri.login_code — kode login PERMANEN pengampu (8 char, alfabet non-ambigu —
  reuse SETUP_CODE_ALPHABET dari accounts), unique, null utk santri biasa.
  Dibuat saat is_pengampu=True; guardian bisa regenerate (kode lama mati).
  Di-QR-kan sebagai URL https://tahsin.ihfazh.com/login?code=XXXXXXXX dan
  dicetak — pengampu boleh scan kapan pun, berkali-kali. Redeem → DRF token
  user pengampu (Token.get_or_create). Regenerate kode juga menghapus token
  lama (paksa login ulang).
```

Aturan integritas:
- `Santri.pengampu` harus `is_pengampu=True` dan `owner` sama.
- Menonaktifkan pengampu → santri ampuannya jadi `pengampu=NULL` (unassigned),
  ditampilkan di guardian sebagai "belum ada pengampu".
- Hapus item/santri: **soft** (`is_active=False`). Hapus record: hard, oleh
  guardian atau pembuat record.
- Boleh >1 record per santri per tanggal (santri bisa setor 2x); UI kasih
  peringatan lunak "sudah ada catatan tanggal ini" (bukan blokir).

## 4. Functional requirements

### Backend (`backend/tahsin/`, prefix `/api/tahsin/`)

- **FR1 `GET me/`** → `{role, display_name, santri_id?, items[], santri[]}`.
  Untuk pengampu: `santri[]` = santri ampuannya saja (aktif). Untuk guardian:
  semua santri aktif miliknya (+ field `pengampu_id`, `is_pengampu`).
- **FR2 Items** — `GET/POST items/`, `PATCH/DELETE items/{id}/` (guardian
  only; DELETE = soft). Reorder via `order`. Saat guardian pertama kali
  membuka app tanpa item → frontend tawarkan seed default (`POST items/seed/`,
  idempotent): **ns/t** + **mt** saja (keputusan §6.2).
- **FR3 Santri** — CRUD `santri/` (guardian only). Field `pengampu` untuk
  assign; endpoint bantu `POST santri/{id}/assign/ {pengampu: id|null}` agar
  UI drag/pick cepat. Set `is_pengampu=True` (create/PATCH) → server otomatis membuat User
  + `login_code`. `GET santri/{id}/login-code/` → `{code, url}` (guardian;
  untuk tampil QR / cetak). `POST santri/{id}/login-code/regenerate/` →
  kode baru, token lama dicabut. `is_pengampu=False` kembali → login_code
  di-null-kan + token dicabut (User tetap ada, tidak dihapus).
- **FR4 Records** — `GET records/?santri=&from=&to=&pengampu=` (guardian:
  semua miliknya; pengampu: hanya santri ampuannya → selain itu 404),
  `POST records/` body `{santri, date, page, page_detail, notes, scores:
  [{item, value}]}` (pengampu hanya boleh `santri` ampuannya → 403),
  `PATCH/DELETE records/{id}/` (guardian, atau `created_by == me`).
  `POST records/bulk/` — array record sekaligus (untuk layar input massal;
  atomic, semua-atau-gagal, balikan error per index).
- **FR5 Summary** — `GET summary/?period=week|month&start=YYYY-MM-DD
  [&santri=][&pengampu=]` → per item: `avg`, `count`, `prev_avg` (periode
  sebelumnya, untuk panah naik/turun); per santri: avg per item + jumlah
  sesi + halaman terakhir. Guardian: semua; pengampu: ampuannya saja.
- **FR6 Print form** — tidak perlu endpoint khusus: frontend memakai `items[]`
  aktif dari `GET me/` untuk merender **lembar harian** (halaman `/print`,
  `window.print()`, CSS `@page A4`). Tidak ada PDF server-side.
- **FR7 Login kode pengampu** — `POST auth/login-code/ {code}` (AllowAny,
  **tanpa rate-limit** — semua santri sering satu IP; keamanan mengandalkan
  entropi kode 31⁸ ≈ 8,5×10¹¹; salah → 400 generik + log) → `{token, name}`. Kode
  **permanen** & bisa dipakai berulang; QR-nya dicetak guardian. Frontend:
  `/login?code=` → redeem otomatis; halaman login juga punya input kode.

Semua endpoint `IsAuthenticated` (kecuali `auth/login-code/`). Object-level:
`owner == request.user` (guardian) atau lewat relasi pengampu.

### Frontend (`tahsin-web/`)

Layar **pengampu** (prioritas kemudahan):
- **Login** — dua cara di satu layar: (a) **kode pengampu** 8 huruf
  (auto-redeem kalau dibuka via `/login?code=` dari QR), (b) username +
  password (guardian). Token disimpan localStorage, "tetap masuk" sampai
  logout.
- **Beranda** — daftar santri ampuan (kartu: nama, terakhir setor tgl X,
  halaman Y). Tombol besar **"Input catatan"**.
- **Input massal (utama)** — pilih tanggal (default hari ini), lalu **daftar
  kartu santri ampuan dengan kotak centang**. Centang = santri setor hari itu →
  kartu terbuka: halaman (angka) + keterangan (teks bebas) + **satu baris per
  aspek** `kode | – 0 1 2 3 4 5` (7 tombol besar; `–` = tidak dinilai). Kartu
  yang tidak dicentang tidak dikirim. Draft otomatis tersimpan di localStorage
  per tanggal (badge "Draft tersimpan"). Kalau santri itu sudah punya catatan
  di tanggal tsb → peringatan kuning di kartu (tidak diblokir). Tombol sticky
  bawah "Simpan N catatan" → `records/bulk/`; offline → "Simpan draft, kirim
  nanti". Tidak ada kolom catatan bebas di input massal (catatan hanya di form
  satu record) — supaya cepat memindahkan lembar harian.
- **Input satu santri / edit** — form yang sama untuk 1 santri (dari kartu
  santri atau baris riwayat) + tanggal + catatan opsional + tombol Hapus.
- **Riwayat santri** — daftar record (tgl, halaman, skor per aspek), edit
  record milik sendiri.

Layar **guardian** — nav bawah: **Dashboard · Kelola · Cetak** (tidak ada
input massal; guardian menilai **pengampu** secara ad-hoc lewat Detail santri →
"+ Tambah catatan": tanggal = hari dinilai, `page` boleh kosong karena tidak
terikat setoran harian). Guardian tetap bisa edit/hapus semua record.
- **Dashboard** — filter periode (pekan ISO / bulan, tombol ‹ ›) + filter
  pengampu. Blok "Perlu perhatian" (item avg terendah) & "Sudah bagus"
  (tertinggi), tabel santri × aspek (heatmap warna 0–5), panah tren vs
  periode sebelumnya.
- **Detail santri** — grafik garis rata-rata per pekan per aspek (3 bulan
  terakhir, aspek bisa di-toggle) + tabel semua record (siapa yang input) +
  "+ Tambah" / edit / hapus.
- **Kelola** — 3 tab. **Aspek**: nama + kode, urutan (= urutan kolom di input
  & lembar cetak), nonaktifkan/aktifkan. **Santri**: tambah cepat (nama saja),
  tap → ubah nama / jadikan pengampu / nonaktifkan; pengampu punya **sheet**:
  QR login permanen + kode teks, "Cetak kartu", "Ganti kode", daftar santrinya.
  **Pengampu** (assignment): per pengampu daftar santrinya + "Pindahkan"
  (pilih dari daftar, bukan drag-drop); bagian "Belum ada pengampu" + "Tetapkan".
- **Cetak lembar A4** (`/print`) — **satu-satunya** form cetak; **tidak terikat
  pengampu/santri** dan **bisa dipakai berulang** (kolom Tanggal ada di dalam
  tabel, bukan di header). Header cukup "Pengampu: ____ · Bulan: ____" (diisi
  tangan). Tabel baris tinggi (±10 mm) `Tanggal | Nama santri | Halaman |
  <kode aspek aktif…>`; baris "Catatan: ____"; footer keterangan `kode = nama
  aspek` + "skor 0–5, kosong = tidak dinilai". Opsi: jumlah baris (default 20 —
  cukup untuk 3–10 santri × beberapa hari), jumlah lembar. Portrait; **landscape
  otomatis bila aspek aktif > 12**. Cetak 1 master → fotokopi; satu lembar dipakai
  beberapa hari, lalu dipindahkan ke app lewat Input massal (pilih tanggal).
- **Cetak kartu QR** (`/print-qr?santri=<id>`) — nama pengampu, QR, kode teks, URL.

PWA: `display: standalone`, ikon, app-shell di-cache; `/api/` NetworkOnly
(sama seperti diary-web).

## 5. Di luar scope v1

- Sinkronisasi offline penuh (antrian record saat offline lalu auto-kirim) —
  v1 hanya draft lokal + kirim saat online.
- Sharing data antar guardian; multi-halaqah/kelas.
- Notifikasi/reminder pengampu.
- Kunci perangkat/kiosk (lihat §8 — dilakukan di sisi Android, bukan app).

## 6. Keputusan (jawaban 2026-08-15)

1. Domain **`tahsin.ihfazh.com`** (sementara).
2. Aspek default seed: **Nun sukun / tanwin (ns/t)** dan **Mad thobi'i (mt)**
   saja — untuk test; sisanya guardian tambah lewat UI.
3. Guardian = **akun yang sudah ada** (yang dipakai app lain). Pengampu tidak
   perlu username/password: User dibuat otomatis, login lewat kode/QR.
4. **QR login permanen** (bukan sekali pakai) — dicetak, dipakai kapan pun.
5. Skor boleh **kosong** = tidak dinilai (tidak semua aspek muncul tiap sesi).
6. Pengampu boleh **edit/hapus** record buatannya **tanpa batas waktu**.
7. Halaman = **angka + teks bebas**; sumber selalu Al-Qur'an (tanpa field sumber).
8. Guardian tidak punya input massal; menilai pengampu ad-hoc dari Detail santri
   (`page` boleh kosong).
9. Form cetak = **lembar harian generik** saja (tidak terikat pengampu), 1 lembar
   per hari per pengampu, difotokopi. Layout per-santri dibuang.
10. Aspek bisa >8 (sampai ±12 nyaman di portrait); pengampu 5–15 santri.

## 7. Kesepakatan UI dari mockup (2026-08-15)

Mockup interaktif: artifact "Tahsin Tracker Mockup" (v5). Detail yang disepakati
dan wajib diikuti implementasi:

| Area | Kesepakatan |
|---|---|
| Login | Satu layar: kolom kode 8 huruf (default) + link "Masuk sebagai ustadz" → username/password. Scan QR → auto-redeem tanpa layar login. Token tersimpan sampai Keluar. |
| Nav pengampu | Beranda · Input · Riwayat |
| Nav guardian | Dashboard · Kelola · Cetak |
| Beranda pengampu | Kartu per santri: nama, terakhir setor + halaman; badge kuning bila > 5 hari tidak setor. Tombol besar "Input catatan". |
| ScorePicker | 7 tombol sejajar `– 0 1 2 3 4 5`; warna 0–1 merah, 2 oranye, 3 kuning, 4–5 hijau; `–` abu. |
| Halaman | Dua input: angka ("Hal.") + teks bebas ("Keterangan: ayat 1–10 / seperempat kedua"). |
| Dashboard | PeriodNav Pekan/Bulan + ‹ ›; select pengampu; kartu "Perlu perhatian" (aspek avg terendah) & "Sudah bagus" (tertinggi); bar rata-rata per aspek (merah < 3, kuning < 4, hijau ≥ 4) + angka periode sebelumnya; heatmap santri × aspek **dikelompokkan per pengampu** (+ grup "Pengampu (dinilai ustadz)"), kolom Sesi & Hal. terakhir, ▲▼ bila beda ≥ 0,25 vs periode sebelumnya, sel kosong = tidak dinilai; nama santri sticky saat scroll horizontal. |
| Ambang | "Jelek" = rata-rata < 3; "bagus" ≥ 4. |
| Kode login | 8 huruf, alfabet non-ambigu, permanen; ditampilkan monospace + QR; "Ganti kode" mematikan kode & sesi lama. |
| Lembar cetak | Generik (tanpa pengampu), **bisa dipakai berulang**: kolom `Tanggal | Nama santri | Halaman | aspek…` (tanggal di dalam tabel, bukan header), ~20 baris, baris Catatan, keterangan kode; header hanya Pengampu + Bulan; tanpa kolom paraf. |
| Kartu QR | Nama pengampu, QR, kode teks, URL `tahsin.ihfazh.com`. |

## 8. Kiosk / kunci perangkat via adb — jawaban singkat

PWA (WebAPK Chrome) **bisa** dikunci dengan **screen pinning** Android
(Settings → Security → App pinning; keluar butuh PIN) — ini bisa diaktifkan
via adb (`settings put secure lock_to_app_enabled 1`) lalu pin dari Recents.
Yang **tidak** bisa untuk PWA: **lock task / device owner** penuh
(`dpm set-device-owner`) — itu butuh APK dengan DeviceAdminReceiver, jadi
harus wrapper native (TWA via Bubblewrap + admin receiver) atau pakai app
kiosk pihak ketiga (mis. *Fully Kiosk Browser*, cukup versi gratis) yang
memuat URL PWA ini. Rekomendasi: mulai dengan screen pinning; kalau kurang
ketat, Fully Kiosk. Tidak ada perubahan di app untuk ini.
