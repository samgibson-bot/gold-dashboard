#!/bin/bash
set -e

echo "🚀 Deploying gold-dashboard..."

# Navigate to docker-compose directory
cd ~/openclaw

# Rebuild Docker image
echo "🔨 Building Docker image..."
docker compose build openclaw-dashboard

# Restart service
echo "♻️  Restarting service..."
docker compose up -d openclaw-dashboard

# Wait for service to start
echo "⏳ Waiting for service to be ready..."
sleep 5

# Health check
echo "🏥 Running health check..."
if curl -f http://localhost:3000/api/admin/status > /dev/null 2>&1; then
  echo "✅ Deployed successfully"
  docker compose logs --tail=3 openclaw-dashboard
else
  echo "❌ Health check failed"
  docker compose logs --tail=20 openclaw-dashboard
  exit 1
fi
