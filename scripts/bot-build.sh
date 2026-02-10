#!/bin/bash
set -e

echo "🤖 Building gold-dashboard (via Docker)..."
cd ~/openclaw

# Build the Docker image (which runs pnpm build inside)
echo "🔨 Building Docker image..."
docker compose build openclaw-dashboard

echo "✅ Build complete"
