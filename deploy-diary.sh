#!/usr/bin/env bash
# Deploy Ruang Cerita (Spec 060) to the ksatriamuslim server.
# Frontend: build locally → rsync to /home/ihfazh/ruangcerita/dist.
# Backend: git pull + migrate + restart the shared gunicorn.
#
# Prereqs (one-time, see deploy/ruangcerita.nginx.conf):
#   - nginx site `ruangcerita` enabled + certbot cert for ruangcerita.ihfazh.com
#   - backend/.env: DJANGO_ALLOWED_HOSTS includes ruangcerita.ihfazh.com,
#     DIARY_USE_X_ACCEL=1
set -euo pipefail

SSH_HOST="${SSH_HOST:-ksatriamuslim}"
REMOTE_APP="/home/ihfazh/hayyabaca"
REMOTE_WEB="/home/ihfazh/ruangcerita/dist"
VENV="$REMOTE_APP/backend/.venv/bin"

echo "==> Gating: frontend typecheck + tests"
( cd diary-web && npm run typecheck && npm run test )

echo "==> Building frontend"
( cd diary-web && npm run build )

echo "==> Uploading frontend to $SSH_HOST:$REMOTE_WEB"
ssh "$SSH_HOST" "mkdir -p $REMOTE_WEB"
rsync -az --delete diary-web/dist/ "$SSH_HOST:$REMOTE_WEB/"

echo "==> Updating backend (git pull + migrate + restart)"
ssh "$SSH_HOST" bash -s <<EOF
set -euo pipefail
cd $REMOTE_APP
git pull --ff-only origin master
cd backend
# manage.py defaults to config.settings.dev (SQLite) — source .env so migrate
# targets the PRODUCTION Postgres, exactly like the systemd EnvironmentFile does.
set -a; . ./.env; set +a
$VENV/python manage.py migrate --noinput
sudo systemctl restart hayyabaca.service
sudo systemctl reload nginx
EOF

echo "==> Done. https://ruangcerita.ihfazh.com/"
