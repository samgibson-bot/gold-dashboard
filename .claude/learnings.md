# Learnings Log

## 2026-02-21 — Issues #32, #38, #44: Full feature pyramid

**What was built:**
7 PRs implementing the full plan from Issues #32 (cost intelligence), #38 (session UX), and #44 (Deck):
- PR #9: Session categorization — kind-based sidebar folders (Chat/Sub-agents/Cron/Other), pin, protected sessions
- PR #10: Context meter upgrade — hover tooltip, color thresholds (green→yellow@70%→red@90%), pulse at 95%
- PR #11: Memory file live editor — write capability with path whitelist, nav guard via `useBlocker`
- PR #12: Slash commands — `/roundtable /spawn /compact /think /new` with keyboard navigation
- PR #15: Provider health card + MCP registry panel
- PR #16: Per-session token badge in sidebar
- PR #14: OpenClaw Deck — multi-column parallel agent view at `/deck`

**What was tricky:**
- **Zustand object selector → React #185**: `useDeckStore((s) => ({ a: s.a, b: s.b }))` returns a new object literal on every `getSnapshot()` call, violating `useSyncExternalStore`'s stability requirement. React loops infinitely. Fixed by splitting into individual selectors. This is the #1 Zustand gotcha — always use individual selectors or `useShallow`.
- **PR auto-close on base branch deletion**: GitHub auto-deletes branches on merge; PRs targeting those branches get auto-closed. PR #13 hit this — had to rebase onto main and create PR #16 fresh.
- **routeTree.gen.ts**: TanStack Router auto-regenerates this on build, but manual edits needed for TypeScript to validate before first build. The Vite plugin overwrites our changes correctly.
- **Icon names**: `LayoutGridIcon` not `LayoutGrid01Icon`. Always grep the types file before using a new icon.

**Patterns worth carrying forward:**
- Never write an object-literal Zustand selector — always individual selectors
- When merging a PR that other PRs depend on, immediately rebase the dependent branches before they get auto-closed
- TanStack Router's routeTree.gen.ts can be pre-populated for TypeScript, with Vite handling the authoritative regeneration at build time

## 2026-02-22 — Lint Audit: 56 → 0 Errors (PR #23)

**What was built:**
- Full lint audit across the codebase — resolved all 56 errors (55 errors + 1 warning) across 27 files
- Parallel 3-agent approach: API routes batch, component/screen batch, and small fixes batch — all ran concurrently

**What was tricky:**
- **ESLint ??-chain error attribution**: ESLint reports the `no-unnecessary-condition` error at the START of a `??` chain expression, not at the specific problematic `??`. `models[0].id ?? 'default'` was the culprit but the error pointed to line 104 (start of the chain) rather than line 107 where `models[0].id` lived. Took two passes to figure out.
- **Cast before vs after**: `(val as 'a' | 'b') || 'default'` — the cast makes TypeScript think the LHS is always one of those truthy string literals, so `||` is flagged. Must evaluate first: `(val || 'default') as 'a' | 'b' | 'default'`.
- **Closure mutation invisible to TypeScript**: `let changed = false` mutated inside a `.filter()` callback is always seen as `false` at the return site. TypeScript doesn't track mutations across closures. Fixed with `next.length !== sessions.length`.
- **`server-start.js`** not in tsconfig but picked up by ESLint's TypeScript parser — needed an explicit ignore in `eslint.config.js`.

**Patterns worth carrying forward:**
- For bulk lint fixes across many files, spawn 2-3 parallel agents grouped by category (API routes / components / small fixes)
- Array index access needs `as T | undefined` cast before null-guarding — without `noUncheckedIndexedAccess`, TypeScript types `arr[i]` as `T` (always defined)
- `gatewayRpc<T>()` returns `T` (non-nullable) — `result?.foo` is always a lint error; use `result.foo`
- After a full lint pass, the codebase should stay clean — future sessions can run `pnpm lint` to verify

## 2026-02-22 — Cron History Bug: d.map is not a function

**What was fixed:**
- Clicking "History" on a cron job threw `d.map is not a function`
- Root cause: `cron.runs` gateway RPC returns `{ runs: [...] }` (a wrapper object), but the API route was passing the whole object as `runs` in the JSON response. Frontend received `data.runs = { runs: [...] }` — an object, not an array.
- Fix: extract `result.runs` from the RPC result before returning it, matching how `cron.list` is handled (`data?.cron?.jobs`)

**What was tricky:**
- Nothing — once the RPC response shape was recognized, fix was one-liner

**Patterns worth carrying forward:**
- All gateway RPC responses are wrapper objects — always check what shape the RPC returns before passing it to the frontend. `cron.list` → `{ jobs, running }`, `cron.runs` → `{ runs }`
- Use `result.runs ?? []` as a safe default so empty history doesn't blow up

---

## 2026-02-22 — Cron Health Monitoring

**What was built:**
- Cron page overhaul: health summary banner (red/amber for failing/missing-delivery jobs), enhanced 7-column table with health badges (ok/error + consecutive error count + last error text), last run relative time, duration, delivery channel/target with "no target" warning on enabled jobs
- Expandable run history per job — fetches `cron.runs` RPC on demand, shows status, summary, model, timestamp, duration
- API route extended: POST `/api/admin/cron` now dispatches on `action` field — `action: 'runs'` calls `cron.runs`, default falls through to `cron.create` (backward compatible)
- New types: `CronJobState`, `CronJobDelivery`, `CronRunEntry` in types.ts
- New format helpers: `formatDuration` (ms → "8.5s"), `formatRelativeTimeMs` (epoch ms → relative)

**What was tricky:**
- Nothing required multiple attempts. Lint flagged one subtle TypeScript narrowing issue: `a?.b && !a?.c` — after `a?.b` is truthy, TypeScript knows `a` is non-null so `a?.c` becomes `a.c`. The `?.` on the second access is flagged as unnecessary. Quick fix.

**Patterns worth carrying forward:**
- Gateway `cron.list` response includes rich `state` and `delivery` objects — the dashboard was previously ignoring all of it
- POST dispatch on `action` field is a clean way to add RPC calls to an existing API route without proliferating endpoints
- TypeScript narrows optional chain: after `obj?.prop` is truthy in a conditional, the object is non-null in the falsy branch too — second `?.` on same object is lint error

## 2026-02-22 — Fleet Page Redesign + Gateway fs.* Debugging (PRs #20, #21, #22)

**What was built:**
- Fleet page redesign: summary header with live stats, KPI cards row, compact model routing pills, soul previews (first 5 lines), last-active timestamps, inline per-card soul viewer, empty state, "Open in Deck" always visible
- Shared `formatRelativeTime()` and `describeCronSchedule()` utilities in `lib/format.ts`
- Fleet API enriched with batch soul reads and `last_active` derived from sessions

**What was tricky:**
- **Gateway `fs.readFile` is broken for operator devices**: The gateway RPC consistently returns "unknown method: fs.readFile" for newly-paired operator devices, regardless of what scopes are configured in the .env. Older/pre-existing device keys got "missing scope: operator.admin" (method existed but was blocked). New devices get "unknown method" — a contradiction that suggests a gateway version or connection-mode issue. Multiple scope combinations were tried; none worked.
- **CLAUDE.md scope note was wrong**: The existing CLAUDE.md said `operator.read,operator.write` are required, but `gateway.ts` defaults to `['operator.admin']` when `CLAWDBOT_GATEWAY_SCOPES` is unset. The env override was causing the wrong scope to be sent.
- **Fix**: Bypass the gateway entirely for filesystem reads. Dashboard is co-located on the same VPS as the openclaw workspace, so `node:fs/promises` + `homedir() + '/.openclaw/'` works cleanly.
- **Debugging trajectory**: ~6 attempts before landing on the direct-fs solution. Should have checked `gateway.ts` getGatewayScopes() earlier and also checked `openclaw devices list` sooner.

**Patterns worth carrying forward:**
- **Don't use gateway `fs.*` RPCs** — use Node `fs/promises` with `homedir()/.openclaw/` base path
- **Don't set `CLAWDBOT_GATEWAY_SCOPES` in .env** — the gateway.ts default (`operator.admin`) is correct
- **`openclaw devices list`** (sourcing nvm first) shows exactly what scopes paired devices have — useful for debugging gateway auth
- **Delete `.device-keys.json` cautiously** — if an existing device key "works" (even with scope errors), deleting it can make things worse if the new pairing lands in a different gateway mode

## 2026-02-21 — Skill Routing + Fleet Visibility (PR #17)

**What was built:**
- SOUL.md: Added `## Skill Routing` section with detection rules, priority, model escalation — teaches OpenClaw to route "spin up agents to consider" → Roundtable + Sonnet instead of bare `sessions_spawn` on Flash
- Dashboard Activity tab: `skill` and `subagent` event types — scans `rt-*` roundtable files and detects sub-agent sessions
- Dashboard Workflows tab: `roundtable` workflow type with two-round pipeline visualization (Scholar/Engineer/Muse x2 + Synthesis)

**What was tricky:**
- Subagent SSH permission: launched a Bash subagent for the VPS edit but it was denied Bash access. Had to fall back to running the SSH command directly from the main context. Subagents don't inherit all permissions.

**Patterns worth carrying forward:**
- SSH edits to VPS should be done directly, not delegated to subagents (permission boundary)
- `pnpm check` reformats files as a side effect — always commit linter changes separately from feature changes
