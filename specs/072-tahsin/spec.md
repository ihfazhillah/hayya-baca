# Spec 072 — Tahsin Tracker (PWA pencatatan perkembangan tahsin santri)

**Status:** Spec approved 2026-08-15 (jawaban §6 dimasukkan) — plan menunggu approval
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
  membuka app tanpa item → frontend tawarkan seed default (ns/t, mt, dst.
  — daftar final dari user).
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
- **FR6 Print form** — `GET print-form/?pengampu=<id>|blank&rows=25` →
  JSON `{pengampu_name, items[]}`; rendering di frontend (halaman print).
  (Tidak perlu PDF server-side — `window.print()` dengan CSS `@page A4`.)
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
- **Input massal (utama)** — pilih tanggal (default hari ini), lalu **tabel
  satu baris per santri**: kolom halaman (angka) + detail (teks) + satu
  kolom per aspek dengan pemilih skor 0–5 (segmented buttons besar, bukan
  dropdown). Baris kosong = santri tidak setor hari itu (dilewati). Draft
  disimpan di localStorage per tanggal (kalau app ketutup, tidak hilang).
  Submit → `records/bulk/`. Online-required saat submit; kalau offline,
  tombol berubah "Simpan draft, kirim nanti".
- **Input satu santri** — form yang sama untuk 1 santri (dari kartu santri).
- **Riwayat santri** — daftar record (tgl, halaman, skor per aspek), edit
  record milik sendiri.

Layar **guardian** (semua di atas + ):
- **Dashboard** — filter periode (pekan ISO / bulan, tombol ‹ ›) + filter
  pengampu. Blok "Perlu perhatian" (item avg terendah) & "Sudah bagus"
  (tertinggi), tabel santri × aspek (heatmap warna 0–5), panah tren vs
  periode sebelumnya.
- **Detail santri** — grafik garis per aspek sepanjang waktu + tabel record.
- **Kelola** — tab Aspek (tambah/urutkan/nonaktifkan), Santri (tambah, tandai
  pengampu → tampil QR login + tombol cetak QR + regenerate), Assignment (per pengampu: daftar
  santrinya, pindah santri antar pengampu).
- **Cetak form A4** — pilih pengampu (atau kosong), jumlah baris. Layout:
  header "Pengampu: ______" (terisi kalau dipilih) + periode kosong;
  tabel kolom `Tanggal | Nama santri | Halaman | <kode aspek…>`; **baris
  kosong** (santri tidak hardcoded); footer keterangan `kode = nama aspek`
  + "skor 0–5". `@media print` A4 portrait, header/footer di tiap halaman.

PWA: `display: standalone`, ikon, app-shell di-cache; `/api/` NetworkOnly
(sama seperti diary-web).

## 5. Di luar scope v1

- Sinkronisasi offline penuh (antrian record saat offline lalu auto-kirim) —
  v1 hanya draft lokal + kirim saat online.
- Sharing data antar guardian; multi-halaqah/kelas.
- Notifikasi/reminder pengampu.
- Kunci perangkat/kiosk (lihat §7 — dilakukan di sisi Android, bukan app).

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

## 7. Kiosk / kunci perangkat via adb — jawaban singkat

PWA (WebAPK Chrome) **bisa** dikunci dengan **screen pinning** Android
(Settings → Security → App pinning; keluar butuh PIN) — ini bisa diaktifkan
via adb (`settings put secure lock_to_app_enabled 1`) lalu pin dari Recents.
Yang **tidak** bisa untuk PWA: **lock task / device owner** penuh
(`dpm set-device-owner`) — itu butuh APK dengan DeviceAdminReceiver, jadi
harus wrapper native (TWA via Bubblewrap + admin receiver) atau pakai app
kiosk pihak ketiga (mis. *Fully Kiosk Browser*, cukup versi gratis) yang
memuat URL PWA ini. Rekomendasi: mulai dengan screen pinning; kalau kurang
ketat, Fully Kiosk. Tidak ada perubahan di app untuk ini.
