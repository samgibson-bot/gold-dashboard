#!/usr/bin/env bash
set -euo pipefail

cd ~/openclaw/openclaw-dashboard
git pull
pnpm install --frozen-lockfile
pnpm build
systemctl --user restart openclaw-dashboard.service
echo "Deploy complete. Check: systemctl --user status openclaw-dashboard.service"
