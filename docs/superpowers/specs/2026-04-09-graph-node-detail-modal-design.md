# Rich Graph Node Detail Modal — Design Spec

**Date:** 2026-04-09
**Status:** Approved, ready for implementation plan
**Scope:** `/admin/graph` node interaction

## Problem

Clicking a node on `/admin/graph` opens a narrow 288px sidebar (`w-72`) that truncates the title, truncates every property value, and shows no source context. Users cannot read full descriptions or understand *why* an entity exists in the graph — there's no view of the source signals that extracted it.

## Goals

1. Show the **full, untruncated** description and properties of any node.
2. Expose the **source signals** that mention the entity — the raw captures from which the entity was extracted.
3. Stay free (no AI summaries, no paid APIs — FalkorDB queries only).
4. Keep the graph canvas visible and uncluttered during quick exploration.

## Non-Goals (YAGNI)

- AI-generated entity summaries.
- Timeline / frequency sparklines.
- Editing node properties from the UI.
- Drill-down into a Signal-detail view (we show signal metadata and digest, not a dedicated signal profile).
- A dedicated `/admin/graph/node/:id` route.

## Approach

**Two-tier surface:**

- **Sidebar (existing `NodeDetailPanel`)** — quick glance. Widen nothing; fix the truncation so title and description wrap. Add a primary "View full details" button.
- **Modal (new `NodeDetailModal`)** — deep dive. ~900px wide, ~80vh tall, portaled, backdrop-dismissible. Fetches extras on-demand when opened.

Rejected alternative: widening the sidebar to 384–448px. Reading prose at that width is cramped, and signals with long digests would feel squished. A modal gives a reading-optimized width without eating graph canvas space.

## Architecture

### New files

- `apps/webclaw/src/screens/admin/graph/node-detail-modal.tsx` — the modal component.
- (No new hook file — the query lives in `graph-queries.ts`.)

### Modified files

- `apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx` — remove `truncate` from title and property values; add "View full details" button.
- `apps/webclaw/src/screens/admin/graph/graph-queries.ts` — add `useNodeDetail(id)` hook using TanStack Query, matching the existing pattern.
- `apps/webclaw/src/screens/admin/graph/graph-types.ts` — add `NodeDetailData` type.
- `apps/webclaw/src/routes/api/admin/graph.ts` — add `section=node` handler.
- `apps/webclaw/src/routes/admin/graph.tsx` — wire modal open/close state; pass through to sidebar.

### New types

```ts
export type NodeSignal = {
  id: string
  source: string
  title: string
  digest: string
  captured_at: string
  url?: string
}

export type NodeDetailData = {
  signals: Array<NodeSignal>
  clusters: Array<{ id: string; name: string; score: number }>
  connectionWeights: Record<string, number> // neighborId -> signal count
}
```

## API

### New endpoint

`GET /api/admin/graph?section=node&id=<nodeId>`

**Response shape:**

```ts
{
  ok: true,
  signals: Array<NodeSignal>,
  clusters: Array<{ id, name, score }>,
  connectionWeights: Record<string, number>
}
```

On failure: `{ ok: false, error: string }` via the existing `sanitizeError()` wrapper.

### Cypher queries

**Signals:**
```cypher
MATCH (e {id: $id})<-[:MENTIONS]-(s:Signal)
RETURN s
ORDER BY s.captured_at DESC
LIMIT 20
```

Signal prop extraction mirrors `handleClusterDetail` (existing code at `graph.ts:250-259`):
- `id` ← `sp.id`
- `source` ← `sp.source`
- `title` ← `sp.title ?? sp.raw_summary ?? ''`
- `digest` ← `sp.digest ?? sp.key_insight ?? ''`
- `captured_at` ← `sp.captured_at`
- `url` ← `sp.url` (optional)

**Clusters this entity appears in:**
```cypher
MATCH (e {id: $id})<-[:MENTIONS]-(s:Signal)-[:MEMBER_OF]->(c:Cluster)
RETURN DISTINCT c
LIMIT 10
```

**Connection weights** (how many signals bridge entity to each co-occurring neighbor):
```cypher
MATCH (e {id: $id})<-[:MENTIONS]-(s:Signal)-[:MENTIONS]->(neighbor)
WHERE neighbor.id <> $id
  AND NOT neighbor:Signal
RETURN neighbor.id AS id, count(s) AS weight
```

All IDs passed into queries are escaped via the existing `.replace(/'/g, "\\'")` pattern used throughout `graph.ts`.

## Data Flow

1. User clicks a node on the canvas → `selectedNode` state updates → sidebar shows basic info (from already-loaded `graphData`).
2. User clicks **"View full details"** in the sidebar → `isDetailOpen` state flips to `true`.
3. Modal mounts → `useNodeDetail(selectedNode.id)` fires via TanStack Query (5-minute stale time, caches by node id).
4. While loading: skeleton shimmer on the extras sections. Basic header (name, type, description, properties) renders immediately from `selectedNode` — no wait for the network.
5. On success: signals, clusters, and weighted connections render.
6. On error: inline error message with a "Retry" button.

## Modal Layout

```
┌─────────────────────────────────────────────────────┐
│ ●  Person · Jane Smith                         [×] │  ← sticky header
├─────────────────────────────────────────────────────┤
│                                                     │
│  Description                                        │
│  Full wrapped description, text-pretty,             │
│  max-w-prose (~65ch) for readability.               │
│                                                     │
│  Properties                                         │
│  role            Senior engineer at Example Inc.    │
│  location        San Francisco                      │
│  created_at      2026-02-14                         │
│  (wrapped, no truncation)                           │
│                                                     │
│  Source signals (12)                                │
│  ┌───────────────────────────────────────────────┐  │
│  │ telegram · 2026-04-08 14:22                   │  │
│  │ "Meeting notes with Jane"                     │  │
│  │ Digest paragraph wraps nicely across lines... │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ email · 2026-04-07 09:10                      │  │
│  │ ...                                           │  │
│  └───────────────────────────────────────────────┘  │
│  (scrollable list, capped at 20)                    │
│                                                     │
│  Clusters (3)                                       │
│  ● Q2 Product Planning          0.87                │
│  ● Hiring Pipeline              0.64                │
│                                                     │
│  Connections (8)                                    │
│  ● Project Alpha         6 signals                  │
│  ● Jane Doe              3 signals                  │
│  (click to navigate — closes modal, centers graph)  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Dimensions:**
- Width: `max-w-[900px]`, `w-[90vw]`
- Max height: `max-h-[85vh]`
- Body: `overflow-y-auto`
- Header: sticky top, bordered bottom.

**Behavior:**
- Backdrop click closes.
- `Escape` key closes.
- Clicking a connection closes the modal and centers the graph on that node (reuses existing `onNavigateToNode`).
- Clusters render as non-interactive chips in v1. (Clicking to navigate to the clusters tab is deferred.)

**Styling:** uses the existing primary palette; no `bg-white`/`bg-black`. Follows the repo's dark-mode-inverted palette rule (`text-primary-900` for body, `text-primary-500` for muted, `bg-primary-50` for surface).

**Empty states:**
- Zero signals → "No source signals found for this entity."
- Zero clusters → section hidden entirely.
- Zero connections → "No connections found."

## Sidebar Changes

Minimal:

1. Remove `truncate` from `h3` at `node-detail-panel.tsx:49` — allow title wrap.
2. Remove `truncate` from `dd` at `node-detail-panel.tsx:103` — allow property value wrap.
3. Add primary "View full details" button above the existing "Expand neighbors" button.
4. Accept a new `onOpenDetail: () => void` prop.

The sidebar retains its 288px width — it's intentionally a glance.

## Error Handling

- **Query throws:** caught by top-level `try/catch` in `graph.ts` route handler, returns `{ ok: false, error }` via `sanitizeError`. Modal shows error + retry.
- **Node not found in DB:** signals/clusters come back empty. Modal still renders header and properties from `selectedNode` (already in memory). Shows "No source signals found."
- **Missing signal fields:** fallback chain already used in `handleClusterDetail` — defaults to empty string or dash.
- **Stale node ID** (user closes modal mid-fetch): TanStack Query handles via component unmount.

## Verification (Manual)

Dashboard has no automated test suite. After implementation:

1. `pnpm -C apps/webclaw dev`
2. Navigate to `/admin/graph`.
3. Click a Person node with known source signals → sidebar opens with full (wrapped) title and description.
4. Click "View full details" → modal opens within 300ms.
5. Confirm signals list populates with title, source, date, digest.
6. Confirm clusters section populates if entity is in any cluster.
7. Confirm connections show signal counts.
8. Click a connection → modal closes, graph centers on the target node.
9. Click a Concept node with zero signals → modal opens, shows "No source signals found."
10. Artificially break the endpoint (rename the route temporarily) → modal shows error + retry button.
11. `pnpm -C apps/webclaw check` → zero lint errors, no reformats.
12. `pnpm -C apps/webclaw build` → clean build.

## Out of Scope (explicit)

- AI summary generation.
- Editing node properties.
- Signal drill-down view.
- Timeline visualization.
- Exporting node details.
- Dedicated node route.

## Open Questions

None at this time. Design approved 2026-04-09.
