# CLAUDE.md — gold-dashboard

## What This Repo Is

`samgibson-bot/gold-dashboard` — the OpenClaw web dashboard. Forked from `ibelick/webclaw`.

**Deployment model: GitHub triggers VPS deploy.**
- Edit locally → PR → merge to main → GitHub Action → SSH to VPS → git pull → pnpm build → systemctl restart
- "I edited the file" is NOT done. "I committed and pushed" is done. `git status` must be clean.

---

## VPS

| | |
|---|---|
| SSH | `ssh claw@100.77.85.46` (Tailscale, preferred) or `ssh claw@62.146.173.127` |
| Dashboard dir | `~/openclaw/openclaw-dashboard/` |
| Service | `gold-dashboard.service` (systemd user service — NOT `openclaw-dashboard.service`) |
| Build output | `apps/webclaw/dist/` |
| Prod CMD | `node server-start.js` |

```bash
# VPS service management
systemctl --user status gold-dashboard.service
systemctl --user restart gold-dashboard.service
journalctl --user -u gold-dashboard.service -n 50

# Emergency manual deploy
ssh claw@100.77.85.46 "bash ~/openclaw/openclaw-dashboard/deploy.sh"
```

---

## Dev Commands

```bash
pnpm -C apps/webclaw dev      # Start dev server
pnpm -C apps/webclaw build    # Production build
pnpm -C apps/webclaw lint     # ESLint
pnpm -C apps/webclaw check    # Format + lint fix (REFORMATS FILES — stage all after running)
```

**After running `check` or any linter:** reformats are real changes that must be committed.
```bash
git add -A   # captures all linter reformats, not just files you edited
git commit -m 'style: apply linter formatting'
git push
```

---

## Branch Hygiene

- Always branch from main: `git checkout -b feat/issue-N-description`
- PR naming: `gh pr create --title "feat: [Issue #N] Description"`
- **Always create a PR immediately after pushing** — do not wait to be asked
- Auto-delete on merge is enabled — after merge: `git branch -D feat/branch-name`
- Run `git fetch --prune` to clean stale remote tracking refs
- **Never force push to main**

### PR Dependency Management
- GitHub auto-deletes branches on merge → PRs targeting that branch get auto-closed
- If a PR gets auto-closed: rebase the branch onto main + `gh pr create` fresh with `--base main`
- Merge order for chained PRs: merge base → `git fetch` → `git rebase origin/main` on dependent → push `--force-with-lease` → merge

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | TanStack Router + TanStack Start |
| Bundler | Vite + Nitro |
| Styling | Tailwind CSS v4 |
| State | Zustand (with persist) |
| Runtime | Node 22.12+ required |
| Package manager | pnpm |

---

## Critical Coding Rules

### Zustand Selectors (CRITICAL — causes infinite loop if wrong)
```typescript
// ❌ WRONG — new object on every call → React error #185
const { columns, mode } = useDeckStore((s) => ({ columns: s.columns, mode: s.mode }))

// ✅ CORRECT — individual selectors
const columns = useDeckStore((s) => s.columns)
const mode = useDeckStore((s) => s.mode)

// ✅ ALSO OK — useShallow when object selector needed
import { useShallow } from 'zustand/react/shallow'
const { columns, mode } = useDeckStore(useShallow((s) => ({ columns: s.columns, mode: s.mode })))
```

### Code Style
- Functions: use `function` keyword, not `const`
- Types: use `type T = {}`, not `interface`
- Files: `kebab-case`
- Never `useEffect` for anything expressible as render logic
- Always use `cn()` (clsx + tailwind-merge) for class logic
- Never arbitrary color values — use the custom palette (`bg-primary-50`, etc.)
- Never `bg-white`, `bg-black`, `text-white`, `text-black`
- `text-balance` on headings, `text-pretty` on body
- `tabular-nums` for data
- Never font weights bolder than `font-medium`

### TypeScript
- `Record<string, string>` makes `??` fallback unnecessary (lint error) — use `Partial<Record<>>` instead
- `routeTree.gen.ts` can be manually updated for TypeScript — regenerated on build

---

## Project Structure

```
apps/webclaw/src/
├── routes/          # TanStack file-based routing
├── screens/         # Screen components (deck/, admin/, etc.)
│   ├── deck/        # Route: /deck | Store: deck-store.ts
│   └── admin/       # Route: /admin | Layout: AdminNav sidebar
├── components/      # Shared components
├── hooks/           # Shared hooks
├── lib/             # Utilities
├── server/          # Nitro server routes
│   └── gateway.ts   # WebSocket gateway
└── styles.css       # Global styles + CSS variables
```

---

## Key Architecture Notes

### Deck Screen
- Route: `/deck` | Store: `deck-store.ts` (Zustand persist, localStorage key: `deck-columns`)
- Per-column SSE via `EventSource('/api/stream?sessionKey=...')`
- Column session key format: `agent:main:<columnId>` — extract columnId via `parts[2]`
- Modes: `free` (manual), `roundtable` (auto-adds subagent sessions), `triage` (idea pipeline)

### Admin Screen
- Layout: `/admin` with `AdminNav` sidebar
- Sections: Overview, Agents, Ideas, System (logs, cron, browser, webhooks, skills, config)
- API routes: `/api/admin/{status,activity,metrics,fleet,workflows,memory,approvals,ideas,logs,cron,browser,webhooks,skills,config}`
- Types: `screens/admin/types.ts` | Query keys: `screens/admin/admin-queries.ts`
- Skills: full CRUD via `gatewayRpc('fs.listDir'/'fs.readFile'/'fs.writeFile')` on `.openclaw/skills/`

### Gateway / Auth
- `CLAWDBOT_GATEWAY_URL=ws://127.0.0.1:18789` → `isLocalClient=true` → auto-approved device pairing
- Device keys: `dist/.device-keys.json` (gitignored via `dist/`)
- Default scopes when `CLAWDBOT_GATEWAY_SCOPES` is unset: `['operator.admin']` (see `server/gateway.ts:292`)
- **Do NOT set `CLAWDBOT_GATEWAY_SCOPES` in `.env`** — the default is correct; overriding it causes scope issues
- `openclaw devices list` (with nvm sourced) shows paired devices and their scopes

### Gateway fs.* RPCs — Unreliable for Dashboard
- `fs.readFile`/`fs.listDir` via gatewayRpc are NOT reliably accessible to operator-role device connections
- **Instead: read openclaw workspace files directly via Node `fs/promises`** (dashboard is co-located on VPS)
- Base path: `homedir() + '/.openclaw/'`
- Fleet: `routes/api/admin/fleet.ts` uses this pattern — copy it for any new file reads

### Ideas System
- All submissions use AI analysis — no static path
- Flow: Submit → OpenClaw `ideas` session → research → GitHub issue + roadmap
- GitHub: `samgibson-bot/gold-ideas` issues

---

## Build Gotchas

- `clsx` missing from explicit deps (transitive) — add it explicitly if needed
- `nitro-nightly` pinned to `3.0.1-20260206-171553-bc737c0c`
- Node 22.12+ required by Vite 7 (22.11.0 warns)
- If deploy fails silently: SSH in and run `pnpm install && pnpm build` manually

---

## Icons

Package: `@hugeicons/core-free-icons`
- No `Dashboard01Icon` → use `DashboardSquare01Icon`
- No `Browser02Icon` → use `BrowserIcon`
- Verify names before using: `grep "IconName" node_modules/.pnpm/@hugeicons+core-free-icons*/...`

---

## Security — Applied Changes (don't revert)

- Deleted `routes/api/paths.ts` (leaked filesystem paths)
- Gateway: 30s timeout, WebSocket reuse
- All API routes use `sanitizeError()` from `server/errors.ts`
- `send.ts`: 100KB message length limit
- `sessions.ts` DELETE: reads from request body (not query params) — CSRF fix
- `markdown.tsx`: blocks `javascript:` protocol in links

---

## OpenClaw Context

The dashboard connects to an OpenClaw gateway running on the same VPS as a systemd user service (`openclaw-gateway.service`). OpenClaw config lives at `~/.openclaw/` on the VPS (NOT `~/openclaw/`).

**OpenClaw PR review:** Send a Telegram message to OpenClaw: "Review PR #X for gold-dashboard"
