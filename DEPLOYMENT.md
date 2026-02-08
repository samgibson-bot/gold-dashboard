# Deployment Guide

## Automated Deployment with GitHub Actions

Every push to the `main` branch automatically deploys to the VPS at `claw@62.146.173.127`.

### Setup Instructions

#### 1. Add SSH Key to GitHub Secrets

You need to add your VPS SSH private key to GitHub so the workflow can deploy.

**Get your SSH private key:**
```bash
# If using the default key:
cat ~/.ssh/id_rsa

# Or if using a specific key:
cat ~/.ssh/your_vps_key
```

**Add to GitHub:**
1. Go to https://github.com/samgibson-bot/gold-dashboard/settings/secrets/actions
2. Click "New repository secret"
3. Name: `VPS_SSH_KEY`
4. Value: Paste your entire private key (including `-----BEGIN` and `-----END` lines)
5. Click "Add secret"

#### 2. Test the Workflow

**Option A: Push to main**
```bash
git push origin main
```

**Option B: Manual trigger**
1. Go to https://github.com/samgibson-bot/gold-dashboard/actions
2. Click "Deploy to VPS" workflow
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"

#### 3. Monitor Deployment

View deployment progress:
1. Go to https://github.com/samgibson-bot/gold-dashboard/actions
2. Click on the running workflow
3. Watch the deployment logs in real-time

Deployment takes ~2-3 minutes:
- Pull code: ~5s
- Build Docker image: ~60-90s
- Restart container: ~10s

### Deployment Flow

```
Local/OpenClaw → Push to main → GitHub Actions → VPS Deploy
```

### Manual Deployment (Backup)

If GitHub Actions is down, deploy manually via SSH:

```bash
ssh claw@62.146.173.127 "cd ~/openclaw/openclaw-dashboard && git pull && cd ~/openclaw && docker compose build openclaw-dashboard && docker compose up -d openclaw-dashboard"
```

Or use the deploy script on the VPS:
```bash
ssh claw@62.146.173.127 "bash ~/openclaw/openclaw-dashboard/deploy.sh"
```

## Workflow for Developers

### Claude Code (Local Development)

```bash
# Start work
git checkout main
git pull origin main
git checkout -b feature/my-feature

# Make changes, test locally
pnpm dev  # Test at http://localhost:3000

# Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/my-feature

# Merge to main (triggers auto-deploy)
git checkout main
git merge feature/my-feature
git push origin main

# Wait ~2 minutes, then check:
# http://100.77.85.46:3000
```

### OpenClaw (VPS Development)

```bash
# Clone or update repo
cd ~/dev
git clone https://github.com/samgibson-bot/gold-dashboard.git
cd gold-dashboard

# Create branch
git checkout -b openclaw/improvements

# Make changes
# ... edit files ...

# Commit and push
git add .
git commit -m "Self-improvement: added feature"
git push origin openclaw/improvements

# Merge to main (triggers auto-deploy)
git checkout main
git pull origin main
git merge openclaw/improvements
git push origin main

# Deployment happens automatically
```

## Troubleshooting

### Deployment fails with "Permission denied"
- Check that `VPS_SSH_KEY` secret is set correctly
- Verify SSH key has access: `ssh claw@62.146.173.127 "echo success"`

### Container fails to start
- Check logs: `ssh claw@62.146.173.127 "docker logs openclaw-openclaw-dashboard-1"`
- Verify env vars: `ssh claw@62.146.173.127 "cd ~/openclaw && docker compose config"`

### Old version still running
- Hard refresh browser (Cmd+Shift+R)
- Check container was rebuilt: `ssh claw@62.146.173.127 "docker images openclaw-openclaw-dashboard"`

## Monitoring

**Check deployment status:**
```bash
ssh claw@62.146.173.127 "docker compose ps openclaw-dashboard"
```

**View logs:**
```bash
ssh claw@62.146.173.127 "docker logs -f openclaw-openclaw-dashboard-1"
```

**Test endpoints:**
```bash
curl http://100.77.85.46:3000
curl http://100.77.85.46:3000/api/health
```
