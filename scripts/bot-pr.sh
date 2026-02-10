#!/bin/bash
set -e

TITLE="${1:-Automated changes}"
BODY="${2:-Changes made by OpenClaw bot}"

cd ~/openclaw/openclaw-dashboard

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "❌ Cannot create PR from main branch"
  exit 1
fi

echo "📝 Creating PR..."
gh pr create \
  --title "$TITLE" \
  --body "$BODY" \
  --head "$CURRENT_BRANCH" \
  --base main

echo "✅ PR created"
