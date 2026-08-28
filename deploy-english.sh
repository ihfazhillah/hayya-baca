#!/usr/bin/env bash
# Deploy the English Practice module to the ksatriamuslim server.
# Frontend: build locally → rsync to /home/ihfazh/english-web/dist.
# Backend:  git pull + uv sync + migrate + (re)install workers + restart gunicorn.
#
# Covers Spec 073 (YouTube shadowing): syncs the `youtube` dependency-group
# (yt-dlp + youtube-transcript-api) into the main .venv and installs the
# english-youtube.service worker alongside english-tts.service.
#
# Prereqs (one-time):
#   - nginx site `english` enabled + certbot for english.ihfazh.com
#     (deploy/english.nginx.conf).
#   - backend/.env: DJANGO_ALLOWED_HOSTS includes english.ihfazh.com;
#     GROQ_API_KEY set (STT). System `ffmpeg` present.
#   - Passwordless sudo for the systemctl/cp lines below (same as tahsin/diary).
set -euo pipefail

SSH_HOST="${SSH_HOST:-ksatriamuslim}"
REMOTE_APP="/home/ihfazh/hayyabaca"
REMOTE_WEB="/home/ihfazh/english-web/dist"
VENV="$REMOTE_APP/backend/.venv/bin"

echo "==> Gating: backend english tests"
( cd backend && .venv/bin/python -m pytest english/tests.py -q )

echo "==> Gating: frontend typecheck + tests"
( cd english-web && npm run typecheck && npm run test )

echo "==> Building frontend"
( cd english-web && npm run build )

echo "==> Uploading frontend to $SSH_HOST:$REMOTE_WEB"
ssh "$SSH_HOST" "mkdir -p $REMOTE_WEB"
rsync -az --delete english-web/dist/ "$SSH_HOST:$REMOTE_WEB/"

echo "==> Updating backend (pull + uv sync + migrate + workers + restart)"
ssh "$SSH_HOST" bash -s <<REMOTE
set -euo pipefail
export PATH="\$HOME/.local/bin:\$HOME/.cargo/bin:\$PATH"
cd $REMOTE_APP
git pull --ff-only origin master
cd backend
# uv sync into the main venv. production is MANDATORY (prune gotcha: without it
# uv removes gunicorn/psycopg); youtube adds yt-dlp + youtube-transcript-api.
uv sync --group production --group tts --group stt --group youtube
# manage.py defaults to config.settings.dev (SQLite) — source .env so migrate
# targets the PRODUCTION Postgres, exactly like the systemd EnvironmentFile does.
set -a; . ./.env; set +a
$VENV/python manage.py migrate --noinput
# Install / refresh the systemd workers (idempotent).
sudo cp $REMOTE_APP/deploy/english-tts.service /etc/systemd/system/english-tts.service
sudo cp $REMOTE_APP/deploy/english-youtube.service /etc/systemd/system/english-youtube.service
sudo systemctl daemon-reload
sudo systemctl enable --now english-youtube.service
# Restart so code changes take effect: gunicorn (serializer/api) + both workers.
sudo systemctl restart hayyabaca.service
sudo systemctl restart english-tts.service
sudo systemctl restart english-youtube.service
sudo systemctl reload nginx
REMOTE

echo "==> Done. https://english.ihfazh.com/"
echo "    Smoke: create a YouTube lesson, then"
echo "    ssh $SSH_HOST 'sudo journalctl -u english-youtube -n 40 --no-pager'"
