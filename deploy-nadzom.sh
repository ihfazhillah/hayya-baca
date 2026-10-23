#!/usr/bin/env bash
# Deploy Nadzom (Spec 076) to the ksatriamuslim server.
# Static site only: build locally → rsync to /home/ihfazh/nadzom-web/dist → reload nginx.
# Does NOT pull, migrate, or restart the shared Django backend.
#
# Prereqs (one-time, after DNS diwan.ihfazh.com points to the server):
#   sudo cp ~/hayyabaca/deploy/nadzom.nginx.conf /etc/nginx/sites-available/nadzom
#   sudo ln -s /etc/nginx/sites-available/nadzom /etc/nginx/sites-enabled/nadzom
#   sudo nginx -t && sudo systemctl reload nginx
#   sudo certbot --nginx -d diwan.ihfazh.com
set -euo pipefail

SSH_HOST="${SSH_HOST:-ksatriamuslim}"
REMOTE_WEB="/home/ihfazh/nadzom-web/dist"

echo "==> Gating: typecheck + tests"
( cd nadzom-web && npm run typecheck && npm run test )

echo "==> Building"
( cd nadzom-web && npm run build )

echo "==> Uploading to $SSH_HOST:$REMOTE_WEB"
ssh "$SSH_HOST" "mkdir -p $REMOTE_WEB"
rsync -az --delete nadzom-web/dist/ "$SSH_HOST:$REMOTE_WEB/"

echo "==> Reloading nginx"
ssh "$SSH_HOST" "sudo nginx -t && sudo systemctl reload nginx"

echo "==> Done. https://diwan.ihfazh.com/"
