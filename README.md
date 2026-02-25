# Gold Dashboard

![Cover](https://raw.githubusercontent.com/ibelick/webclaw/main/apps/webclaw/public/cover.jpg)

Admin dashboard for OpenClaw. Forked from [ibelick/webclaw](https://github.com/ibelick/webclaw) with added admin features, security hardening, and production deployment support.

**Features:**
- Real-time WebSocket communication with OpenClaw Gateway
- Admin pages: status, tokens, logs, cron, config, browser, missions
- Chat interface with conversation export, search, and context window meter
- Security: error sanitization, CSRF protection, message limits, XSS prevention
- Automated deployment via GitHub Actions

## Setup

Create `apps/webclaw/.env.local` with `CLAWDBOT_GATEWAY_URL` and either
`CLAWDBOT_GATEWAY_TOKEN` (recommended) or `CLAWDBOT_GATEWAY_PASSWORD`. These map
to your OpenClaw Gateway auth (`gateway.auth.token` or `gateway.auth.password`).
Default URL is `wss://nm-vps.tail9452d2.ts.net:18789`. Docs: https://docs.openclaw.ai/gateway

```bash
pnpm install
pnpm dev
```

## Deployment

Pushing to `main` automatically deploys to the production VPS via GitHub Actions.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- GitHub Actions setup instructions
- Adding SSH keys to GitHub Secrets
- Manual deployment options
- Troubleshooting

**Quick deploy:**
```bash
git push origin main
# Wait ~2 minutes for automated deployment
```
