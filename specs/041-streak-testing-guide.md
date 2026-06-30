# Panduan Pengujian Manual — Sistem Streak

## Setup

1. Build APK:
   ```bash
   cd /home/ihf/Dev/hayya-baca
   JAVA_HOME=$HOME/.jdks/temurin-17 ./build-test.sh
   ```

2. Start emulator (WAJIB `-gpu host`):
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export QT_QPA_PLATFORM=xcb
   tmux new-session -d -s emu "emulator -avd hayya_api33 -gpu host -no-snapshot-load"
   adb wait-for-device
   ```

3. Install APK:
   ```bash
   adb install -r android/app/build/outputs/apk/release/hayya-baca-test.apk
   adb shell monkey -p com.ihfazh.hayyabaca -c android.intent.category.LAUNCHER 1
   ```

4. Backend (jika test lokal):
   ```bash
   ./scripts/test-local.sh --skip-build
   ```

## Koneksi ke Production

APK ini dikonfigurasi ke `https://hayyabaca.ihfazh.com`. Verifikasi:
- Login berhasil dengan akun produksi
- Data stories tersinkronisasi

## Checklist Pengujian Streak

| # | Langkah | Hasil Diharapkan |
|---|---------|------------------|
| 1 | Login ke aplikasi | User terautentikasi |
| 2 | Buka halaman home | Streak counter tampil (0 atau sesuai data) |
| 3 | Baca satu story lengkap | Streak increment +1 setelah selesai |
| 4 | Logout & login kembali | Streak value persist |
| 5 | Baca story hari berikutnya | Streak terus increment |
| 6 | Skip sehari, lalu baca lagi | Streak reset ke 1 |
| 7 | Cek rewards (coin/star) | Rewards terupdate sesuai streak |

## Verifikasi di Emulator

```bash
# Cek app running
adb shell pidof com.ihfazh.hayyabaca

# Cek error/ANR
adb logcat -t -60s | grep -iE 'FATAL|ANR'

# Screenshot
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

## Cleanup

```bash
adb emu kill
tmux kill-session -t emu
```

## Package Name

`com.ihfazh.hayyabaca` (bukan `com.hayyabaca`)