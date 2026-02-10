#!/bin/bash
set -e

echo "⚡ Quick restart (no rebuild)..."
cd ~/openclaw

# Just restart the service
docker compose restart openclaw-dashboard

# Wait and health check
echo "⏳ Waiting for service..."
sleep 3

if curl -f http://localhost:3000/api/admin/status > /dev/null 2>&1; then
  echo "✅ Service restarted"
else
  echo "❌ Health check failed"
  docker compose logs --tail=20 openclaw-dashboard
  exit 1
fi
