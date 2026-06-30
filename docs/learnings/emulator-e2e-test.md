# E2E Test di Emulator (anti force-close) — VERIFIED

Runbook untuk agent menjalankan & memverifikasi app Hayya Baca di emulator Android
**sampai app benar-benar jalan**. Ditulis setelah debugging panjang "emulator force
close terus". Alur di bawah sudah **diverifikasi end-to-end** (app boot ke homescreen,
`pidof` hidup, `MainActivity` resumed, 0 FATAL di logcat).

## TL;DR — penyebab force-close & fix-nya

**Penyebab "force-close" = emulator pakai SOFTWARE rendering (SwiftShader), bukan GPU.**
Dua gejala, satu akar:
1. **Headless / tanpa display** (`-no-window`, atau di sesi tanpa GPU/DISPLAY): qemu
   **SIGSEGV** saat init grafis — host Vulkan menarik layer implisit (mesa
   `VkLayer_MESA_device_select` + NVIDIA `VK_LAYER_NV_optimus/present`) yang tidak
   kompatibel. Emulator mati ~24 detik. (22 coredump saat investigasi.)
2. **Dengan window tapi `-gpu swiftshader_indirect`**: tidak segfault, tapi render via
   CPU **sangat lambat** → proses sistem Android ANR → dialog **"isn't responding —
   Close / Wait"** muncul **sebelum** homescreen. Inilah "force-close" yang terlihat.

**FIX: pakai `-gpu host`** supaya emulator memakai GPU asli (mesin ini: NVIDIA RTX
5060 Ti, driver 595). Boot selesai ~70 detik, tidak ada force-close. **Jangan pakai
`-gpu swiftshader_indirect` / software rendering.**

> Catatan environment: di sesi **headless** (tanpa DISPLAY, mis. sandbox/CI) emulator
> ini **tidak bisa** boot — `-gpu host` butuh GPU+display context, `-gpu swiftshader`
> segfault. Jalankan di **desktop session asli** (DISPLAY=:0). Cek `nvidia-smi` dulu.

## Prasyarat (set tiap shell baru — tidak otomatis di PATH)

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="$HOME/.jdks/temurin-17"        # Fedora hanya punya JDK 25 (ditolak AGP); Temurin 17 portable
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export QT_QPA_PLATFORM=xcb                        # emulator Qt tak punya plugin wayland; jalan via XWayland

adb version            # harus kebaca
java -version          # harus 17.x, BUKAN 25
nvidia-smi -L          # pastikan GPU terdeteksi (kunci untuk -gpu host)
```

- Kalau `~/.jdks/temurin-17` belum ada: download Temurin JDK 17 portable dari
  Adoptium (`.../v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse`),
  extract ke `~/.jdks/`, symlink `temurin-17`. Download ~185MB — jalankan di background.
- `backend/.venv` harus ada (`cd backend && uv sync` sekali).
- AVD: `hayya_api33` (x86_64, android-33 google_apis).

## Langkah

### 1. Start emulator pakai GPU (BUKAN software)

```bash
emulator -avd hayya_api33 -gpu host -no-snapshot-load &
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
adb shell input keyevent 82   # unlock
```

Verifikasi GPU dipakai (di log emulator harus muncul):
```
vulkan_mode_selected:host gles_mode_selected:host
Selecting Vulkan device: NVIDIA GeForce RTX 5060 Ti
Boot completed in NNNNN ms
```
Kalau muncul `ICD set to 'swiftshader'` atau `Google SwiftShader` → masih software,
boot akan ANR/force-close. Pastikan flag `-gpu host` dan `nvidia-smi` jalan.

- `-no-snapshot-load`: cold boot bersih (snapshot `default_boot` sering gagal di-load).
- Boot pertama ~70 detik. Kalau ada dialog "isn't responding" di boot pertama: klik
  **Wait**. Dengan `-gpu host` mestinya tidak muncul.

### 2. Start backend lokal (port 8123)

App hard-code `http://10.0.2.2:8123/api` untuk `__DEV__` (`src/lib/api.ts`).

```bash
./scripts/test-local.sh --skip-build    # start backend + npm test, TANPA build dev
```

`--skip-build` penting: tanpa itu script jalanin `expo run:android` (dev build) yang
butuh Metro. Untuk e2e kita pakai test APK self-contained (langkah 3).

### 3. Build test APK (JS dibundel — tidak butuh Metro)

```bash
./build-test.sh
# output: android/app/build/outputs/apk/release/hayya-baca-test.apk (~54MB)
```

`build-test.sh` butuh `JAVA_HOME` ke JDK 17 (lihat prasyarat) — kalau kosong, gradle
assembleRelease gagal.

### 4. Install + launch + VERIFIKASI

```bash
APK=android/app/build/outputs/apk/release/hayya-baca-test.apk
adb install -r "$APK"
adb logcat -c
adb shell monkey -p com.ihfazh.hayyabaca -c android.intent.category.LAUNCHER 1

# verifikasi app benar-benar jalan (bukan force-close):
adb shell pidof com.ihfazh.hayyabaca          # ada PID = RUNNING
adb shell dumpsys activity activities | grep topResumedActivity   # = .../.MainActivity
adb logcat -d | grep -iE "FATAL EXCEPTION|ANR in com.ihfazh"      # harus KOSONG
adb exec-out screencap -p > /tmp/app.png      # bukti visual
```

Lolos jika: `pidof` mengembalikan PID, `topResumedActivity` = `com.ihfazh.hayyabaca/.MainActivity`,
dan tidak ada FATAL/ANR.

## Kalau `-gpu host` segfault (driver/GPU sangat baru vs emulator)

Coba berurutan:
1. `-gpu auto` (biarkan emulator pilih).
2. Update emulator: `sdkmanager --install emulator` (36.6.11 = terbaru per Jun 2026).
3. Terakhir, software + matikan layer Vulkan implisit (lambat, rawan ANR — beri waktu,
   klik Wait):
   ```bash
   export NODEVICE_SELECT=1 DISABLE_LAYER_NV_OPTIMUS_1=1 DISABLE_LAYER_NV_PRESENT_1=1
   emulator -avd hayya_api33 -gpu swiftshader_indirect &
   ```
   (env di atas = `disable_environment` resmi tiap layer di
   `/usr/share/vulkan/implicit_layer.d/*.json`; mencegah segfault tapi tetap lambat.)

## Catatan penting

- **`npm run test:e2e` ≠ emulator.** Itu Jest + Django murni (port 8124), tidak
  menyentuh emulator. Jangan tertukar.
- **Jangan pakai dev build** (`expo run:android`/`test-local.sh` tanpa `--skip-build`)
  untuk verifikasi otomatis — dev build butuh Metro hidup + `adb reverse tcp:8081`,
  rapuh. Test APK self-contained lebih andal.
- Stop backend: `kill $(cat /tmp/hayya-baca-backend.pid)`. Stop emulator: `adb emu kill`.
- Bersihkan artefak aneh di root repo (`build`, `in`, `tmux`, dst) sebelum commit.
