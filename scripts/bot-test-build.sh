#!/bin/bash
set -e

echo "🧪 Testing build (via Docker)..."
cd ~/openclaw

# Build without cache to ensure clean build
echo "🔨 Building Docker image..."
docker compose build --no-cache openclaw-dashboard

echo "✅ Build test passed"
