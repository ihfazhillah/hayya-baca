#!/usr/bin/env bash
set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────
APP_NAME="hayya-baca"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$APP_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
ARCH="arm64-v8a"

# ─── Preflight checks ───────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set."
  exit 1
fi

if [ -z "${JAVA_HOME:-}" ]; then
  echo "ERROR: JAVA_HOME is not set."
  exit 1
fi

# ─── Version from app.json ───────────────────────────────────────────
VERSION=$(node -e "console.log(require('$APP_DIR/app.json').expo.version)")
TAG="v${VERSION}"
echo "Building $APP_NAME $TAG (arch: $ARCH)"

# ─── Accept SDK licenses (non-interactive) ───────────────────────────
yes 2>/dev/null | sdkmanager --licenses > /dev/null 2>&1 || true

# ─── Regenerate native project ───────────────────────────────────────
echo "Regenerating android/ with expo prebuild..."
cd "$APP_DIR"
npx expo prebuild --clean --platform android --no-install

# ─── Build release APK ──────────────────────────────────────────────
echo "Building release APK..."
cd "$APP_DIR/android"
./gradlew assembleRelease -PreactNativeArchitectures="$ARCH" --no-daemon

if [ ! -f "$APK_PATH" ]; then
  echo "ERROR: Build failed — APK not found at $APK_PATH"
  exit 1
fi

# Rename APK to hayya-baca-vX.Y.Z.apk
FINAL_APK="$ANDROID_DIR/app/build/outputs/apk/release/${APP_NAME}-${TAG}.apk"
cp "$APK_PATH" "$FINAL_APK"
APK_PATH="$FINAL_APK"

APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
echo ""
echo "Build successful!"
echo "  APK: $APK_PATH"
echo "  Size: $APK_SIZE"

# ─── Git tag + GitHub release ────────────────────────────────────────
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo ""
  echo "WARNING: Tag $TAG already exists."
  read -rp "Overwrite and re-release? [y/N] " answer
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    git tag -d "$TAG"
    git push origin --delete "$TAG" 2>/dev/null || true
  else
    echo "Skipping release. APK is still at: $APK_PATH"
    exit 0
  fi
fi

echo ""
echo "Creating tag $TAG..."
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

if command -v gh >/dev/null 2>&1; then
  echo "Creating GitHub release..."
  gh release create "$TAG" "$APK_PATH" \
    --title "$APP_NAME $TAG" \
    --notes "Release $VERSION

Built with:
- Expo SDK 55 / React Native 0.83
- Architecture: $ARCH
- Signed with debug keystore (sideload only)"
  echo ""
  echo "Release published!"
else
  echo ""
  echo "gh CLI not found — tag pushed but no GitHub release created."
fi
