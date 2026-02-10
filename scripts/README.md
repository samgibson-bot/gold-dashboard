# Bot Helper Scripts

These scripts enable OpenClaw bot to autonomously work on the gold-dashboard.

## Quick Reference

| Script | Purpose | Speed | When to Use |
|--------|---------|-------|-------------|
| `bot-build.sh` | Test if code builds | ~2-3 min | Before committing |
| `bot-deploy.sh` | Full deploy | ~2-3 min | After merging PR |
| `bot-quick-deploy.sh` | Restart only | ~5 sec | Config changes |
| `bot-pr.sh` | Create PR | ~2 sec | After committing |

## Scripts

### `bot-build.sh`
Tests if code builds successfully (via Docker).
- Builds Docker image (includes pnpm build)
- Does NOT restart service
- Use to verify changes compile before committing

```bash
./scripts/bot-build.sh
```

### `bot-deploy.sh`
Full deployment with Docker rebuild.
- Rebuilds Docker image
- Restarts service
- Runs health check

```bash
./scripts/bot-deploy.sh
```

### `bot-quick-deploy.sh`
Quick restart without rebuild.
- Just restarts the container
- Use for config-only changes

```bash
./scripts/bot-quick-deploy.sh
```

### `bot-pr.sh`
Creates a pull request.

```bash
./scripts/bot-pr.sh "PR title" "PR description"
```

## Bot Workflow: Feature Development

### 1. Start New Feature

```bash
cd ~/openclaw/openclaw-dashboard
git checkout main
git pull origin main
git checkout -b feature/add-dark-mode
```

### 2. Make Changes

Edit files in `~/openclaw/openclaw-dashboard/`:
- Frontend: `apps/webclaw/src/`
- API routes: `apps/webclaw/src/routes/api/`
- Types: `apps/webclaw/src/screens/admin/types.ts`

### 3. Test Build

```bash
# Test if changes compile
./scripts/bot-build.sh
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat: add dark mode toggle

- Add theme context
- Add toggle button to header
- Persist preference to localStorage

Co-Authored-By: OpenClaw Bot <openclaw@samgibson.ai>"

git push origin feature/add-dark-mode
```

### 5. Create Pull Request

```bash
./scripts/bot-pr.sh "Add dark mode toggle" "Implements dark mode with user preference persistence."
```

### 6. After PR Merge

```bash
git checkout main
git pull origin main
./scripts/bot-deploy.sh
```

## Bot Workflow: Quick Fixes

For simple changes (typos, small tweaks):

```bash
cd ~/openclaw/openclaw-dashboard
git checkout main
git pull origin main

# Make edit...
# (bot edits file directly)

git add .
git commit -m "fix: correct typo in status page"
git push origin main

./scripts/bot-deploy.sh
```

## File Locations

- **Dashboard repo**: `~/openclaw/openclaw-dashboard/`
- **Docker compose**: `~/openclaw/docker-compose.yml`
- **Production URL**: `http://100.77.85.46:3000`
- **GitHub**: `git@github.com:samgibson-bot/gold-dashboard.git`

## Important Notes

### For the Bot:
- ✅ Always work in feature branches (except tiny fixes)
- ✅ Run `bot-build.sh` before committing
- ✅ Use descriptive commit messages
- ✅ Add "Co-Authored-By: OpenClaw Bot" to commits
- ✅ Create PRs for review (except emergencies)
- ❌ Never force push
- ❌ Never commit secrets or credentials

### Build Process:
- Builds happen **inside Docker** container
- Host system doesn't need Node.js/pnpm
- Changes to code require Docker rebuild
- Config-only changes can use quick restart

### Git Configuration:
- Remote: SSH (git@github.com)
- User: samgibson-bot
- SSH key: `~/.ssh/id_ed25519`
