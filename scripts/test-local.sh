#!/usr/bin/env bash
# Dev build + local backend for emulator testing.
# Usage: ./scripts/test-local.sh [--skip-tests] [--skip-backend] [--skip-build]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
BACKEND_PORT=8123
BACKEND_PID_FILE="/tmp/hayya-baca-backend.pid"
BACKEND_LOG="/tmp/hayya-baca-backend.log"

SKIP_TESTS=0
SKIP_BACKEND=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-backend) SKIP_BACKEND=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

cd "$APP_DIR"

# 1. Emulator check — must be running before we build.
if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found. Set ANDROID_HOME and add platform-tools to PATH." >&2
  exit 1
fi
DEVICES=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
if [ -z "$DEVICES" ]; then
  echo "ERROR: No emulator/device attached. Start an emulator first." >&2
  exit 1
fi
echo "Device: $DEVICES"

# 2. Tests (gating).
if [ "$SKIP_TESTS" -eq 0 ]; then
  echo "Running npm test..."
  npm test
fi

# 3. Backend — start if not already listening on port.
if [ "$SKIP_BACKEND" -eq 0 ]; then
  if ss -tln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
    echo "Backend already listening on :$BACKEND_PORT — reusing."
  else
    if [ ! -d "$BACKEND_DIR/.venv" ]; then
      echo "ERROR: backend/.venv not found. Run: cd backend && uv sync" >&2
      exit 1
    fi
    echo "Applying migrations..."
    (cd "$BACKEND_DIR" && .venv/bin/python manage.py migrate --noinput)
    echo "Starting Django on 0.0.0.0:$BACKEND_PORT (logs: $BACKEND_LOG)..."
    (cd "$BACKEND_DIR" && nohup .venv/bin/python manage.py runserver 0.0.0.0:$BACKEND_PORT \
      > "$BACKEND_LOG" 2>&1 &
      echo $! > "$BACKEND_PID_FILE")
    sleep 1
    if ! ss -tln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
      echo "ERROR: backend failed to start. See $BACKEND_LOG" >&2
      tail -20 "$BACKEND_LOG" >&2
      exit 1
    fi
    echo "Backend up (PID $(cat $BACKEND_PID_FILE))."
  fi
  # Emulator reaches host via 10.0.2.2 — api.ts already hard-codes this for __DEV__.
fi

# 4. Dev build + install to emulator.
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "Running expo run:android (dev build)..."
  npx expo run:android
fi

echo ""
echo "Local test ready."
echo "  Backend: http://localhost:$BACKEND_PORT  (emulator: http://10.0.2.2:$BACKEND_PORT)"
echo "  Stop backend: kill \$(cat $BACKEND_PID_FILE)"
echo "  Backend logs: tail -f $BACKEND_LOG"
