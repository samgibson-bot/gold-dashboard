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
