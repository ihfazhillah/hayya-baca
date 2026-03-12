#!/usr/bin/env bash
set -euo pipefail

# Create an AVD mimicking Galaxy Tab A7 Lite (SM-T225)
# Specs: 8.7" 800x1340, ~179dpi, Android 14 (using API 35 image)

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
AVD_NAME="galaxy-tab-a7-lite"
SYSTEM_IMAGE="system-images;android-35;google_apis;x86_64"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

# Check system image exists
if [ ! -d "$ANDROID_HOME/system-images/android-35/google_apis/x86_64" ]; then
  echo "System image not found. Installing..."
  yes | "$SDKMANAGER" "emulator" "$SYSTEM_IMAGE"
fi

# Delete existing AVD if present
"$AVDMANAGER" delete avd -n "$AVD_NAME" 2>/dev/null || true

# Create AVD
echo "Creating AVD: $AVD_NAME"
echo "no" | "$AVDMANAGER" create avd \
  -n "$AVD_NAME" \
  -k "$SYSTEM_IMAGE" \
  -d "pixel_c"

# Galaxy Tab A7 Lite: 800x1340, 179dpi, 3GB RAM
AVD_DIR="$HOME/.android/avd/${AVD_NAME}.avd"
cat >> "$AVD_DIR/config.ini" <<EOF
hw.lcd.width=800
hw.lcd.height=1340
hw.lcd.density=179
hw.ramSize=3072
hw.keyboard=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
skin.dynamic=yes
disk.dataPartition.size=4096M
EOF

echo "AVD '$AVD_NAME' created!"
echo ""
echo "Run with:"
echo "  $ANDROID_HOME/emulator/emulator -avd $AVD_NAME"
