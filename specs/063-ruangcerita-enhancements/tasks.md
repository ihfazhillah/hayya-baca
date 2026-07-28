# Tasks 063 — Peningkatan Ruang Cerita

**Status:** Implementasi selesai — menunggu deploy (T8 sisa: `deploy-diary.sh`)
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) (approved 2026-07-28)

Aturan pengerjaan:

- **Test-first**: tulis test yang FAIL dulu (pytest backend, Vitest FE), baru implementasi.
- Satu task = satu commit (`feat(diary): …` / `feat(diary-web): …`).
- pytest + `npx tsc` + `npx vitest run` hijau di tiap commit.
- Checklist dicentang (`[x]`) saat selesai.

---

## Fase 1 — Perbaikan FE mandiri (tanpa backend)

- [x] **T1 — Komentar multi-baris (F1)**
  `CommentThread` Composer → `<textarea>` (Enter=newline, tombol Kirim);
  `plainDoc` pecah `\n` jadi `paragraph[]`.
  Test: `plainDoc` 2 baris → 2 paragraph; render 2 `<p>`.

- [x] **T2 — Toggle password (F2)**
  `PasswordInput` (ikon mata) di `ui.tsx`; pakai di `Lobby` & `SetupPage`.

## Fase 2 — Reset via scan QR (F3+F4)

- [x] **T3 — Scanner + alur reset anak**
  `QrScanner.tsx` (`BarcodeDetector` + fallback), `parseSetupCode(url)`,
  link "Lupa kata sandi? Scan QR" di prompt anak (Lobby) → `/setup?code=…`.
  Relabel tombol Admin jadi "Reset kata sandi".
  Test: `parseSetupCode` benar.

## Fase 3 — Edit post terbit (F5)

- [x] **T4 — Edit post published**
  Editor mode "terbit" (tanpa tombol Terbitkan, header "Selesai"); autosave jalan.
  Test (pytest): anak update post published → 200, `published_at` tetap, tak notify.

## Fase 4 — Filter + resolve curhat (F6+F7)

- [x] **T5 — Backend resolve + filter**
  `Post.resolved_at` + migrasi; `PostResolveView` (POST/DELETE, guardian, curhat-only);
  `FeedView` param `type` & `resolved` + sembunyikan resolved default; serializer
  expose `resolved_at`/`is_resolved`.
  Test: resolve/unresolve, non-curhat 400, isolasi, feed hide/show, filter type.

- [x] **T6 — FE filter + tombol resolve**
  `endpoints.feed({type,resolved})` + `resolvePost`/`unresolvePost`; `types.ts`
  `resolved_at`. `Feed.tsx` chip tipe + sub-filter curhat selesai/belum; tombol
  "Tandai selesai"/"Buka lagi" di feed & `GuardianPostDetail`.
  Test (Vitest): filter memanggil endpoint dengan param benar.

## Fase 5 — Sesi persist ortu (F8)

- [x] **T7 — Toggle perangkat orang tua**
  `sessionStore` `trusted` + persist/restore guardian, idle-lock nonaktif saat
  trusted; `SessionProvider.setTrusted`; toggle UI di pengaturan ortu.
  Test (Vitest): trusted persist & restore guardian; non-trusted tidak.

## Fase 6 — Verifikasi & rilis

- [ ] **T8 — Suite hijau + deploy**
  pytest + `npx tsc` + vitest hijau. `./deploy-diary.sh` (migrasi `resolved_at`
  ikut). Smoke test device: komentar multi-baris; toggle password; anak scan QR
  reset; edit post terbit; ortu filter tipe + resolve curhat (hilang dari feed);
  toggle perangkat ortu → refresh tak login ulang.

---

## Catatan risiko

- `BarcodeDetector` tak universal → fallback ketik kode wajib.
- Migrasi `resolved_at` → deploy jalankan `migrate` (source `.env`).
- Token guardian di localStorage (F8) hanya saat toggle ON.
