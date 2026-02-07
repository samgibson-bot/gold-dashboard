#!/usr/bin/env bash
set -euo pipefail

cd ~/openclaw/openclaw-dashboard && git pull
cd ~/openclaw && docker compose build openclaw-dashboard
docker compose up -d openclaw-dashboard
echo "Deploy complete. Check: docker compose ps"
