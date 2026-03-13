#!/usr/bin/env bash
set -euo pipefail

# Build x86_64 APK for emulator testing (manual or e2e).
# Usage:
#   ./build-test.sh              # build only
#   ./build-test.sh --install    # build + install to running emulator
#   ./build-test.sh --run        # build + install + launch app

APP_NAME="hayya-baca"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$APP_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
ARCH="x86_64"
ADB="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb"

# ─── Preflight checks ───────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
fi

if [ -z "${JAVA_HOME:-}" ]; then
  echo "ERROR: JAVA_HOME is not set."
  exit 1
fi

# ─── Version from app.json ───────────────────────────────────────────
VERSION=$(cd "$APP_DIR" && npx expo config --json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).version))")
echo "Building $APP_NAME v${VERSION} for emulator (arch: $ARCH)"

# ─── Regenerate native project ───────────────────────────────────────
echo "Regenerating android/ with expo prebuild..."
cd "$APP_DIR"
npx expo prebuild --clean --platform android --no-install

# ─── Build release APK ──────────────────────────────────────────────
echo "Building release APK (x86_64)..."
cd "$APP_DIR/android"
./gradlew assembleRelease -PreactNativeArchitectures="$ARCH" --no-daemon

if [ ! -f "$APK_PATH" ]; then
  echo "ERROR: Build failed — APK not found at $APK_PATH"
  exit 1
fi

FINAL_APK="$ANDROID_DIR/app/build/outputs/apk/release/${APP_NAME}-test.apk"
cp "$APK_PATH" "$FINAL_APK"

APK_SIZE=$(du -h "$FINAL_APK" | cut -f1)
echo ""
echo "Build successful!"
echo "  APK: $FINAL_APK"
echo "  Size: $APK_SIZE"

# ─── Install + launch ───────────────────────────────────────────────
if [[ "${1:-}" == "--install" || "${1:-}" == "--run" ]]; then
  echo ""
  echo "Installing to emulator..."
  "$ADB" install -r "$FINAL_APK"
  echo "Installed."
fi

if [[ "${1:-}" == "--run" ]]; then
  echo "Launching app..."
  "$ADB" shell am start -n com.ihfazh.hayyabaca/.MainActivity
fi
