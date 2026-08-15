#!/usr/bin/env bash
# Deploy Tahsin Tracker (Spec 072) to the ksatriamuslim server.
# Frontend: build locally → rsync to /home/ihfazh/tahsin-web/dist.
# Backend: git pull + migrate + restart the shared gunicorn.
#
# Prereqs (one-time):
#   - nginx site `tahsin` enabled + certbot cert for tahsin.ihfazh.com
#     (deploy/tahsin.nginx.conf).
#   - backend/.env: DJANGO_ALLOWED_HOSTS includes tahsin.ihfazh.com
#     (CSRF_TRUSTED_ORIGINS is derived from it in production settings).
set -euo pipefail

SSH_HOST="${SSH_HOST:-ksatriamuslim}"
REMOTE_APP="/home/ihfazh/hayyabaca"
REMOTE_WEB="/home/ihfazh/tahsin-web/dist"
VENV="$REMOTE_APP/backend/.venv/bin"

echo "==> Gating: backend tahsin tests"
( cd backend && .venv/bin/python -m pytest tahsin/tests.py -q )

echo "==> Gating: frontend typecheck + tests"
( cd tahsin-web && npm run typecheck && npm run test )

echo "==> Building frontend"
( cd tahsin-web && npm run build )

echo "==> Uploading frontend to $SSH_HOST:$REMOTE_WEB"
ssh "$SSH_HOST" "mkdir -p $REMOTE_WEB"
rsync -az --delete tahsin-web/dist/ "$SSH_HOST:$REMOTE_WEB/"

echo "==> Updating backend (git pull + migrate + restart)"
ssh "$SSH_HOST" bash -s <<REMOTE
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
REMOTE

echo "==> Done. https://tahsin.ihfazh.com/"
