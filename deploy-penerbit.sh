#!/usr/bin/env bash
# Deploy Penerbit Rumah (Spec 074) to the ksatriamuslim server.
# Frontend: build locally → rsync to /home/ihfazh/penerbit-web/dist.
# Backend: git pull + uv sync + migrate + impor_course + restart the shared gunicorn.
#
# Prereqs (one-time):
#   - nginx site `penerbit` enabled + certbot cert for penerbit.ihfazh.com
#     (deploy/penerbit.nginx.conf).
#   - backend/.env: DJANGO_ALLOWED_HOSTS includes penerbit.ihfazh.com and
#     PENERBIT_USE_X_ACCEL=1 (book covers via nginx internal location).
set -euo pipefail

SSH_HOST="${SSH_HOST:-ksatriamuslim}"
REMOTE_APP="/home/ihfazh/hayyabaca"
REMOTE_WEB="/home/ihfazh/penerbit-web/dist"
VENV="$REMOTE_APP/backend/.venv/bin"

echo "==> Gating: backend penerbit tests"
( cd backend && .venv/bin/python -m pytest penerbit -q )

echo "==> Gating: frontend typecheck + tests"
( cd penerbit-web && npm run typecheck && npm run test )

echo "==> Building frontend"
( cd penerbit-web && npm run build )

echo "==> Uploading frontend to $SSH_HOST:$REMOTE_WEB"
ssh "$SSH_HOST" "mkdir -p $REMOTE_WEB"
rsync -az --delete penerbit-web/dist/ "$SSH_HOST:$REMOTE_WEB/"

echo "==> Updating backend (git pull + uv sync + migrate + impor_course + restart)"
ssh "$SSH_HOST" bash -s <<REMOTE
set -euo pipefail
export PATH="\$HOME/.local/bin:\$HOME/.cargo/bin:\$PATH"
cd $REMOTE_APP
git pull --ff-only origin master
cd backend
# Keep every dependency group the server uses, or uv sync drops them.
uv sync --group production --group tts --group stt --group youtube
set -a; . ./.env; set +a
$VENV/python manage.py migrate --noinput
$VENV/python manage.py impor_course penerbit/course/musim-1
sudo systemctl restart hayyabaca.service
sudo systemctl reload nginx
REMOTE

echo "==> Done. https://penerbit.ihfazh.com/"
