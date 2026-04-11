#!/usr/bin/env bash
# Spin up isolated Django backend for e2e sync tests, run jest, cleanup.
# Usage: ./scripts/e2e-backend.sh [-- <extra jest args>]
#
# Isolation: DB at /tmp/hayya-baca-e2e.sqlite3, port 8124.
# Does NOT touch dev runserver (8123) or backend/db.sqlite3.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
PORT=8124
DB_PATH="/tmp/hayya-baca-e2e.sqlite3"
PID_FILE="/tmp/hayya-baca-e2e-backend.pid"
LOG_FILE="/tmp/hayya-baca-e2e-backend.log"

KEEP_DB="${E2E_KEEP_DB:-0}"

cleanup() {
  local code=$?
  set +e
  # Kill by recorded PID if still alive.
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      for _ in 1 2 3 4; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  # Fallback: kill anything still listening on $PORT (subshell PID mismatch
  # can leave the real runserver orphaned). Safe — $PORT is e2e-dedicated.
  local lingering
  lingering=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $NF}' | grep -oP 'pid=\K[0-9]+' | sort -u)
  for p in $lingering; do
    kill "$p" 2>/dev/null
    sleep 0.3
    kill -9 "$p" 2>/dev/null || true
  done
  if [ "$KEEP_DB" != "1" ]; then
    rm -f "$DB_PATH"
  else
    echo "E2E_KEEP_DB=1 — leaving $DB_PATH for inspection"
  fi
  exit $code
}
trap cleanup EXIT INT TERM

# Preflight
if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo "ERROR: $BACKEND_DIR/.venv missing. Run: cd backend && uv sync" >&2
  exit 1
fi
if ss -tln 2>/dev/null | grep -q ":$PORT "; then
  echo "ERROR: port $PORT already in use — another e2e run? Kill it first." >&2
  exit 1
fi

echo "==> Setup DB at $DB_PATH"
rm -f "$DB_PATH"
export E2E_DB_PATH="$DB_PATH"
export DJANGO_SETTINGS_MODULE=config.settings.e2e
(cd "$BACKEND_DIR" && .venv/bin/python manage.py migrate --noinput > "$LOG_FILE" 2>&1)
(cd "$BACKEND_DIR" && .venv/bin/python manage.py seed_e2e >> "$LOG_FILE" 2>&1)

echo "==> Start backend on 127.0.0.1:$PORT (log: $LOG_FILE)"
(cd "$BACKEND_DIR" && nohup .venv/bin/python manage.py runserver 127.0.0.1:$PORT --noreload \
  >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE")

# Wait for port
for _ in $(seq 1 20); do
  if ss -tln 2>/dev/null | grep -q ":$PORT "; then
    break
  fi
  sleep 0.5
done
if ! ss -tln 2>/dev/null | grep -q ":$PORT "; then
  echo "ERROR: backend failed to start. Last log:" >&2
  tail -30 "$LOG_FILE" >&2
  exit 1
fi
echo "Backend up (PID $(cat "$PID_FILE"))"

echo "==> Run jest e2e suite"
cd "$APP_DIR"
API_BASE_URL="http://127.0.0.1:$PORT/api" \
  npx jest --config jest.e2e.config.js --runInBand "$@"
