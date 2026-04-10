# Rich Graph Node Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow, truncation-heavy node detail sidebar on `/admin/graph` with a two-tier surface — an un-truncated sidebar glance plus a deep-dive modal showing description, properties, source signals, clusters, and weighted connections.

**Architecture:** One new React component (`NodeDetailModal`), one new API route handler (`section=node` in the existing graph route), one new TanStack Query hook, and minor edits to the existing sidebar and page component. All data comes from FalkorDB via three Cypher queries — no AI calls, no new dependencies.

**Tech Stack:** TanStack Router + Start, React 19, TanStack Query, Tailwind CSS v4 (primary palette), FalkorDB (compact format helpers in `server/falkordb.ts`).

**Spec:** `docs/superpowers/specs/2026-04-09-graph-node-detail-modal-design.md`

**Branch:** `feat/graph-node-detail-modal` (spec commit `db1b8ac` already on this branch)

**Testing context:** The dashboard has no automated test suite. Verification is manual (dev server + lint + build). No unit tests to write.

---

## File Structure

**New files:**
- `apps/webclaw/src/screens/admin/graph/node-detail-modal.tsx` — the modal component. Self-contained: imports the hook, renders header/description/properties/signals/clusters/connections sections, handles loading/error/empty states, portal + backdrop.

**Modified files:**
- `apps/webclaw/src/screens/admin/graph/graph-types.ts` — add `NodeSignal`, `NodeDetailData` types.
- `apps/webclaw/src/routes/api/admin/graph.ts` — add `handleNodeDetail(id)` and route it from the `section` switch.
- `apps/webclaw/src/screens/admin/graph/graph-queries.ts` — add `useNodeDetail(id, enabled)` hook.
- `apps/webclaw/src/screens/admin/admin-queries.ts` — add `graphNodeDetail(id)` query key.
- `apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx` — remove `truncate` on title + property values, add `onOpenDetail` prop + "View full details" button.
- `apps/webclaw/src/routes/admin/graph.tsx` — wire modal open/close state, render `<NodeDetailModal />`.

**Each file has one clear responsibility.** The modal owns its fetch and render; the sidebar stays a glance; the page owns the selection/open state.

---

## Task 1: Add TypeScript types

**Files:**
- Modify: `apps/webclaw/src/screens/admin/graph/graph-types.ts`

- [ ] **Step 1: Append new types to `graph-types.ts`**

Add these types at the end of the file (after the existing `ENTITY_COLORS` record):

```ts
export type NodeSignal = {
  id: string
  source: string
  title: string
  digest: string
  captured_at: string
  url?: string
}

export type NodeClusterSummary = {
  id: string
  name: string
  score: number
}

export type NodeDetailData = {
  signals: Array<NodeSignal>
  clusters: Array<NodeClusterSummary>
  connectionWeights: Record<string, number>
}
```

- [ ] **Step 2: Run the type checker to confirm the file compiles**

Run: `pnpm -C apps/webclaw build 2>&1 | head -30`
Expected: build progresses past the type-check stage without errors referencing `graph-types.ts`. (It's fine if later steps fail — we're only checking this file type-checks.)

- [ ] **Step 3: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/graph-types.ts
git commit -m "feat(graph): add node detail types"
```

---

## Task 2: Add API route handler

**Files:**
- Modify: `apps/webclaw/src/routes/api/admin/graph.ts`

**Context:** The existing route handler is a `switch` on `section` inside the GET handler (lines 32–67). Three new queries go into a new `handleNodeDetail` function that mirrors the style of `handleClusterDetail` (lines 237–283). All string interpolation into Cypher must be escaped via the existing `.replace(/'/g, "\\'")` pattern used throughout the file.

- [ ] **Step 1: Add the route branch**

In the `section` switch inside the GET handler (after the existing `'cluster'` branch near line 62), add:

```ts
if (section === 'node') {
  const id = url.searchParams.get('id') ?? ''
  if (!id)
    return json({ ok: false, error: 'id required' }, { status: 400 })
  return await handleNodeDetail(id)
}
```

- [ ] **Step 2: Add the import for `NodeDetailData`**

Update the top-level type import from `graph-types` to include `NodeDetailData` and `NodeSignal`:

```ts
import type {
  ClusterDetail,
  ClusterSummary,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphOverview,
  NodeDetailData,
  NodeSignal,
} from '../../../screens/admin/graph/graph-types'
```

- [ ] **Step 3: Implement `handleNodeDetail`**

Add this function at the end of the file (after `handleSearch`):

```ts
async function handleNodeDetail(id: string) {
  const safeId = id.replace(/'/g, "\\'")

  // Source signals that mention this entity
  const signalResult = await graphQuery(
    `MATCH (e {id: '${safeId}'})<-[:MENTIONS]-(s:Signal)
     RETURN s ORDER BY s.captured_at DESC LIMIT 20`,
  )
  const signals: Array<NodeSignal> = signalResult.rows.map(
    function mapSignal(row) {
      const sp = parseCompactNode(row[0]) ?? {}
      return {
        id: String(sp.id ?? ''),
        source: String(sp.source ?? ''),
        title: String(sp.title ?? sp.raw_summary ?? ''),
        digest: String(sp.digest ?? sp.key_insight ?? ''),
        captured_at: String(sp.captured_at ?? ''),
        url: sp.url ? String(sp.url) : undefined,
      }
    },
  )

  // Clusters this entity appears in
  const clusterResult = await graphQuery(
    `MATCH (e {id: '${safeId}'})<-[:MENTIONS]-(s:Signal)-[:MEMBER_OF]->(c:Cluster)
     RETURN DISTINCT c LIMIT 10`,
  )
  const clusters = clusterResult.rows.map(function mapCluster(row) {
    const cp = parseCompactNode(row[0]) ?? {}
    return {
      id: String(cp.id ?? ''),
      name: String(cp.theme ?? cp.name ?? cp.title ?? ''),
      score: Number(cp.score ?? 0),
    }
  })

  // Connection weights — signals bridging this entity to each co-occurring neighbor
  const weightResult = await graphQuery(
    `MATCH (e {id: '${safeId}'})<-[:MENTIONS]-(s:Signal)-[:MENTIONS]->(neighbor)
     WHERE neighbor.id <> '${safeId}' AND NOT neighbor:Signal
     RETURN neighbor.id AS id, count(s) AS weight`,
  )
  const connectionWeights: Record<string, number> = {}
  for (const row of weightResult.rows) {
    const nid = String(unwrapScalar(row[0]) ?? '')
    const weight = Number(unwrapScalar(row[1]) ?? 0)
    if (nid) connectionWeights[nid] = weight
  }

  const data: NodeDetailData = { signals, clusters, connectionWeights }
  return json({ ok: true, ...data })
}
```

- [ ] **Step 4: Verify the file compiles**

Run: `pnpm -C apps/webclaw build 2>&1 | tail -30`
Expected: no TypeScript errors referencing `graph.ts`. (Dev build success not required yet — later tasks complete the wiring.)

- [ ] **Step 5: Commit**

```bash
git add apps/webclaw/src/routes/api/admin/graph.ts
git commit -m "feat(graph): add node detail API handler"
```

---

## Task 3: Verify the endpoint against a real node

**Files:** None (verification-only)

**Context:** Per CLAUDE.md, gateway RPC response shapes must be verified before coding against them. Here, it's our own API, but the same principle applies — confirm the shape is what we expect before building UI on top.

- [ ] **Step 1: Start the dev server locally**

Run: `pnpm -C apps/webclaw dev`
Expected: server starts on http://localhost:3000 (or similar). Leave it running in a separate terminal.

- [ ] **Step 2: Find a real node ID to test with**

Run: `curl -s 'http://localhost:3000/api/admin/graph?section=graph&limit=5' | python3 -m json.tool | head -40`
Expected: JSON with `nodes[]`. Grab any `id` value from the first node for the next step.

- [ ] **Step 3: Hit the new endpoint**

Run: `curl -s "http://localhost:3000/api/admin/graph?section=node&id=<paste-id-here>" | python3 -m json.tool`
Expected output shape:
```json
{
  "ok": true,
  "signals": [
    { "id": "...", "source": "...", "title": "...", "digest": "...", "captured_at": "...", "url": "..." }
  ],
  "clusters": [ { "id": "...", "name": "...", "score": 0.87 } ],
  "connectionWeights": { "neighbor-id-1": 6, "neighbor-id-2": 3 }
}
```

If any field is missing or the response shape differs, stop and reconcile the implementation before moving on. In particular, verify `signals[0].digest` is non-empty for at least one signal — this is the most visible field in the modal.

- [ ] **Step 4: Test the error path**

Run: `curl -s "http://localhost:3000/api/admin/graph?section=node" | python3 -m json.tool`
Expected: `{ "ok": false, "error": "id required" }` with HTTP 400.

- [ ] **Step 5: No commit (verification-only task)**

Leave the dev server running for later tasks.

---

## Task 4: Add TanStack Query hook

**Files:**
- Modify: `apps/webclaw/src/screens/admin/admin-queries.ts`
- Modify: `apps/webclaw/src/screens/admin/graph/graph-queries.ts`

- [ ] **Step 1: Add the query key**

In `apps/webclaw/src/screens/admin/admin-queries.ts`, add this entry inside the `adminQueryKeys` object after the existing `graphNeighbors` entry (around line 41):

```ts
  graphNodeDetail: function graphNodeDetail(id: string) {
    return ['admin', 'graph', 'node-detail', id] as const
  },
```

- [ ] **Step 2: Add the `useNodeDetail` hook**

In `apps/webclaw/src/screens/admin/graph/graph-queries.ts`, update the type import to include `NodeDetailData`:

```ts
import type {
  ClusterDetail,
  ClusterSummary,
  GraphData,
  GraphNode,
  GraphOverview,
  NodeDetailData,
} from './graph-types'
```

Then append this hook at the end of the file:

```ts
export function useNodeDetail(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: adminQueryKeys.graphNodeDetail(id ?? ''),
    queryFn: async function fetchNodeDetail() {
      const data = (await fetchGraph('node', { id: id ?? '' })) as {
        ok: boolean
      } & NodeDetailData
      return data
    },
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
  })
}
```

- [ ] **Step 3: Verify the files compile**

Run: `pnpm -C apps/webclaw build 2>&1 | tail -30`
Expected: no TypeScript errors in `graph-queries.ts` or `admin-queries.ts`. (Build may still fail on the modal file which doesn't exist yet — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add apps/webclaw/src/screens/admin/admin-queries.ts apps/webclaw/src/screens/admin/graph/graph-queries.ts
git commit -m "feat(graph): add useNodeDetail query hook"
```

---

## Task 5: Un-truncate the sidebar and add "View full details" button

**Files:**
- Modify: `apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx`

**Context:** Two `truncate` classes to remove (title at line 49, property value at line 103). Add a new `onOpenDetail: () => void` prop and a prominent button above the existing "Expand neighbors" button.

- [ ] **Step 1: Add the prop**

Update the `NodeDetailPanelProps` type at the top of the file:

```ts
type NodeDetailPanelProps = {
  node: GraphNode | null
  neighbors: Array<{
    id: string
    name: string
    label: string
    relationship: string
  }>
  onClose: () => void
  onExpand: (nodeId: string) => void
  onNavigateToNode: (nodeId: string) => void
  onOpenDetail: () => void
}
```

Then update the destructured props in the function signature:

```ts
export function NodeDetailPanel({
  node,
  neighbors,
  onClose,
  onExpand,
  onNavigateToNode,
  onOpenDetail,
}: NodeDetailPanelProps) {
```

- [ ] **Step 2: Remove `truncate` from the title**

In the header section, find:

```tsx
<h3 className="truncate text-sm font-medium text-primary-900">
  {node.name}
</h3>
```

Replace with:

```tsx
<h3 className="text-balance text-sm font-medium text-primary-900">
  {node.name}
</h3>
```

- [ ] **Step 3: Remove `truncate` from property values**

Find the `dd` element in the Properties section:

```tsx
<dd className="truncate text-primary-800">
  {formatValue(value)}
</dd>
```

Replace with:

```tsx
<dd className="break-words text-pretty text-primary-800">
  {formatValue(value)}
</dd>
```

- [ ] **Step 4: Add the "View full details" button**

Find the "Expand neighbors" button block (starts with `{/* Expand button */}` around line 79). Replace the entire div with a two-button stack:

```tsx
{/* Actions */}
<div className="flex flex-col gap-2 border-b border-primary-200 p-3">
  <button
    type="button"
    onClick={onOpenDetail}
    className="w-full rounded-md bg-primary-900 px-3 py-1.5 text-xs font-medium text-primary-50 hover:bg-primary-800"
  >
    View full details
  </button>
  <button
    type="button"
    onClick={function expand() {
      onExpand(node.id)
    }}
    className="w-full rounded-md bg-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-300"
  >
    Expand neighbors
  </button>
</div>
```

Note the palette: `bg-primary-900` + `text-primary-50` is the high-contrast primary button pattern. Per CLAUDE.md, in dark mode this auto-inverts correctly — do NOT add `dark:` overrides.

- [ ] **Step 5: Verify the file compiles**

Run: `pnpm -C apps/webclaw build 2>&1 | tail -20`
Expected: the graph.tsx route will now fail to compile (missing `onOpenDetail` prop). That's expected — we wire it in Task 7. Confirm `node-detail-panel.tsx` itself has no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx
git commit -m "feat(graph): un-truncate sidebar + add view-details action"
```

---

## Task 6: Create the `NodeDetailModal` component

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/node-detail-modal.tsx`

**Context:** This is the biggest task. The modal is self-contained: it takes `node`, `neighbors`, `isOpen`, `onClose`, and `onNavigateToNode` props. It handles its own data fetch via `useNodeDetail`. It portals into `document.body` and handles backdrop + Escape dismissal.

- [ ] **Step 1: Create the file with the full component**

Create `apps/webclaw/src/screens/admin/graph/node-detail-modal.tsx`:

```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ENTITY_COLORS } from './graph-types'
import type { GraphNode } from './graph-types'
import { useNodeDetail } from './graph-queries'
import { cn } from '@/lib/utils'

type Neighbor = {
  id: string
  name: string
  label: string
  relationship: string
}

type NodeDetailModalProps = {
  node: GraphNode | null
  neighbors: Array<Neighbor>
  isOpen: boolean
  onClose: () => void
  onNavigateToNode: (nodeId: string) => void
}

const SKIP_PROPERTIES = new Set([
  'id',
  'name',
  'title',
  'label',
  '_label',
  'embedding',
  'nodeLabel',
  'nodeData',
  'description',
])

export function NodeDetailModal({
  node,
  neighbors,
  isOpen,
  onClose,
  onNavigateToNode,
}: NodeDetailModalProps) {
  const detail = useNodeDetail(node?.id ?? null, isOpen)

  useEffect(
    function bindEscape() {
      if (!isOpen) return
      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', onKey)
      return function cleanup() {
        window.removeEventListener('keydown', onKey)
      }
    },
    [isOpen, onClose],
  )

  if (!isOpen || !node) return null
  if (typeof document === 'undefined') return null

  const description = String(node.properties.description ?? '').trim()
  const displayProps = Object.entries(node.properties).filter(
    function filterProps([key]) {
      return !SKIP_PROPERTIES.has(key)
    },
  )

  const weights = detail.data?.connectionWeights ?? {}
  const weightedNeighbors = [...neighbors]
    .map(function withWeight(n) {
      return { ...n, weight: weights[n.id] ?? 0 }
    })
    .sort(function byWeight(a, b) {
      return b.weight - a.weight
    })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-lg border border-primary-200 bg-primary-50 shadow-xl"
        onClick={function stop(e) {
          e.stopPropagation()
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-primary-200 p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: ENTITY_COLORS[node.label] ?? '#6b7280',
                }}
              />
              <span className="text-xs uppercase tracking-wide text-primary-500">
                {node.label}
              </span>
            </div>
            <h2 className="text-balance text-lg font-medium text-primary-900">
              {node.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-3 shrink-0 text-primary-400 hover:text-primary-700"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          {description && (
            <section className="border-b border-primary-200 p-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-500">
                Description
              </h3>
              <p className="max-w-prose text-pretty text-sm text-primary-900">
                {description}
              </p>
            </section>
          )}

          {/* Properties */}
          {displayProps.length > 0 && (
            <section className="border-b border-primary-200 p-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-500">
                Properties
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {displayProps.map(function renderProp([key, value]) {
                  return (
                    <div key={key} className="contents">
                      <dt className="text-primary-500">{key}</dt>
                      <dd className="break-words text-pretty text-primary-900">
                        {formatValue(value)}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>
          )}

          {/* Source signals */}
          <section className="border-b border-primary-200 p-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-primary-500">
              Source signals{' '}
              {detail.data ? `(${detail.data.signals.length})` : ''}
            </h3>
            {detail.isLoading && <SkeletonList />}
            {detail.isError && (
              <ErrorBlock
                onRetry={function retry() {
                  void detail.refetch()
                }}
              />
            )}
            {detail.data && detail.data.signals.length === 0 && (
              <p className="text-sm text-primary-500">
                No source signals found for this entity.
              </p>
            )}
            {detail.data && detail.data.signals.length > 0 && (
              <ul className="space-y-3">
                {detail.data.signals.map(function renderSignal(s) {
                  return (
                    <li
                      key={s.id}
                      className="rounded-md border border-primary-200 bg-primary-100 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-primary-500">
                        <span className="font-medium text-primary-600">
                          {s.source || 'unknown'}
                        </span>
                        {s.captured_at && (
                          <>
                            <span>·</span>
                            <span className="tabular-nums">
                              {formatDate(s.captured_at)}
                            </span>
                          </>
                        )}
                      </div>
                      {s.title && (
                        <div className="mb-1 text-sm font-medium text-primary-900">
                          {s.title}
                        </div>
                      )}
                      {s.digest && (
                        <p className="text-pretty text-sm text-primary-800">
                          {s.digest}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Clusters */}
          {detail.data && detail.data.clusters.length > 0 && (
            <section className="border-b border-primary-200 p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-primary-500">
                Clusters ({detail.data.clusters.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {detail.data.clusters.map(function renderCluster(c) {
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-full bg-primary-200 px-3 py-1 text-xs text-primary-800"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: ENTITY_COLORS.Cluster }}
                      />
                      <span>{c.name}</span>
                      <span className="tabular-nums text-primary-500">
                        {c.score.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Connections */}
          <section className="p-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-primary-500">
              Connections ({weightedNeighbors.length})
            </h3>
            {weightedNeighbors.length === 0 && (
              <p className="text-sm text-primary-500">No connections found.</p>
            )}
            <ul className="space-y-1">
              {weightedNeighbors.map(function renderNeighbor(n) {
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={function navigate() {
                        onNavigateToNode(n.id)
                        onClose()
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                        'hover:bg-primary-200',
                      )}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: ENTITY_COLORS[n.label] ?? '#6b7280',
                        }}
                      />
                      <span className="flex-1 text-primary-900">{n.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-primary-500">
                        {n.weight > 0
                          ? `${n.weight} signal${n.weight === 1 ? '' : 's'}`
                          : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map(function renderSkeleton(i) {
        return (
          <li
            key={i}
            className="h-20 animate-pulse rounded-md border border-primary-200 bg-primary-100"
          />
        )
      })}
    </ul>
  )
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-md border border-primary-200 bg-primary-100 p-3 text-sm">
      <p className="mb-2 text-primary-700">Failed to load node details.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-primary-200 px-3 py-1 text-xs font-medium text-primary-800 hover:bg-primary-300"
      >
        Retry
      </button>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm -C apps/webclaw build 2>&1 | tail -30`
Expected: no TypeScript errors in `node-detail-modal.tsx`. (Build may still fail on `graph.tsx` until Task 7 — that's fine.)

- [ ] **Step 3: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/node-detail-modal.tsx
git commit -m "feat(graph): add NodeDetailModal component"
```

---

## Task 7: Wire the modal into the page component

**Files:**
- Modify: `apps/webclaw/src/routes/admin/graph.tsx`

**Context:** Add a piece of state (`isDetailOpen`), pass `onOpenDetail` to the sidebar, and render `<NodeDetailModal>` next to `<NodeDetailPanel>`.

- [ ] **Step 1: Add the modal import**

Near the existing graph imports at the top of `graph.tsx`, add:

```ts
import { NodeDetailModal } from '@/screens/admin/graph/node-detail-modal'
```

- [ ] **Step 2: Add the `isDetailOpen` state**

Inside `GraphPage` function, after `const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)`, add:

```ts
const [isDetailOpen, setIsDetailOpen] = useState(false)
```

- [ ] **Step 3: Close the modal when selection clears**

Find the `handleNodeClick` callback. Update it to also close the modal when clicking empty canvas:

```ts
const handleNodeClick = useCallback(function handleNodeClick(
  node: GraphNode | null,
) {
  setSelectedNode(node)
  if (!node) setIsDetailOpen(false)
}, [])
```

- [ ] **Step 4: Pass `onOpenDetail` to the sidebar and render the modal**

Find the existing `<NodeDetailPanel ... />` usage. Add the `onOpenDetail` prop:

```tsx
<NodeDetailPanel
  node={selectedNode}
  neighbors={neighbors}
  onClose={function close() {
    setSelectedNode(null)
    setIsDetailOpen(false)
  }}
  onExpand={handleNodeExpand}
  onNavigateToNode={handleNavigateToNode}
  onOpenDetail={function openDetail() {
    setIsDetailOpen(true)
  }}
/>
```

Then, immediately after the sidebar (still inside the `activeTab === 'graph'` block), render the modal:

```tsx
<NodeDetailModal
  node={selectedNode}
  neighbors={neighbors}
  isOpen={isDetailOpen}
  onClose={function closeDetail() {
    setIsDetailOpen(false)
  }}
  onNavigateToNode={handleNavigateToNode}
/>
```

The modal can live as a direct child of the `activeTab === 'graph'` container — since it portals to `document.body`, its position in the tree doesn't matter for layout.

- [ ] **Step 5: Verify the whole app builds**

Run: `pnpm -C apps/webclaw build 2>&1 | tail -20`
Expected: build completes with no TypeScript errors. Note any warnings but don't fix anything unrelated.

- [ ] **Step 6: Commit**

```bash
git add apps/webclaw/src/routes/admin/graph.tsx
git commit -m "feat(graph): wire node detail modal into graph page"
```

---

## Task 8: Manual verification

**Files:** None (verification-only)

**Context:** The dashboard has no automated tests. This task walks through the full user flow against the dev server.

- [ ] **Step 1: Ensure dev server is running**

Run (if not already running): `pnpm -C apps/webclaw dev`
Expected: server up on http://localhost:3000.

- [ ] **Step 2: Navigate to the graph page**

Open http://localhost:3000/admin/graph in a browser. The graph canvas should load with nodes visible.

- [ ] **Step 3: Sidebar glance test**

Click any node with a description (Person or Project nodes usually have one).
- Expected: sidebar opens on the right.
- Title wraps across multiple lines if long (no `…` truncation).
- Property values wrap (no `…` truncation).
- A prominent "View full details" button is visible above "Expand neighbors."

- [ ] **Step 4: Modal open test**

Click "View full details."
- Expected: modal opens centered, ~900px wide, with backdrop.
- Header shows the node label pill and full name.
- Description section renders with full wrapped prose (if the node has a description).
- Properties section lists all non-skipped props.
- Source signals section shows a skeleton shimmer briefly, then populates.

- [ ] **Step 5: Signals population test**

Verify the signals section renders:
- Source name (e.g., "telegram", "email").
- Captured date formatted like "Apr 8, 2026, 2:22 PM".
- Signal title in bold.
- Digest paragraph wraps cleanly.

- [ ] **Step 6: Connections + weights test**

Scroll to the Connections section. Verify neighbors are sorted by weight (highest first) and each shows "N signals" on the right.

- [ ] **Step 7: Navigation test**

Click a connection. Expected: modal closes, graph re-centers on the target node, sidebar switches to show the new selection.

- [ ] **Step 8: Empty-state test**

Find a Concept or ActionItem node that likely has few or zero source signals. Click it, open details.
- Expected: modal still opens, "No source signals found for this entity." message appears. No crash.

- [ ] **Step 9: Dismissal tests**

- Click the backdrop outside the modal → closes.
- Open modal, press `Escape` → closes.
- Open modal, click the `×` button → closes.

- [ ] **Step 10: Dark mode test**

Toggle the dashboard's dark mode (however the app supports it — system preference is fine). Re-open the modal. Verify:
- Background still has contrast (no unreadable text).
- Primary palette inverts correctly (text readable).
- No hard-coded colors bleeding through.

- [ ] **Step 11: No commit (verification-only task)**

Note any issues found and fix them via new commits to this branch before continuing. If all checks pass, move to Task 9.

---

## Task 9: Lint, format, and final build

**Files:** Any files the linter reformats.

**Context:** Per CLAUDE.md, `pnpm check` reformats files — those reformats must be committed.

- [ ] **Step 1: Run lint + format**

Run: `pnpm -C apps/webclaw check`
Expected: zero errors. Files may be reformatted.

- [ ] **Step 2: Check for reformats**

Run: `git status`
Expected: either clean, or a list of reformatted files. If any files were reformatted, stage and commit them:

```bash
git add -A
git commit -m "style: apply linter formatting"
```

- [ ] **Step 3: Final production build**

Run: `pnpm -C apps/webclaw build`
Expected: build succeeds with no TypeScript errors. Some bundler warnings may be pre-existing — don't fix unrelated warnings.

- [ ] **Step 4: No commit if clean**

If the build was clean and lint was clean, no new commit is needed for this task.

---

## Task 10: Push branch and open PR

**Files:** None.

**Context:** Per CLAUDE.md: "Always create a PR immediately after pushing — do not wait to be asked." PR title format: `feat: [Issue #N] Description` — if there's no linked issue, omit the issue number.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/graph-node-detail-modal
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --title "feat: rich graph node detail modal" --body "$(cat <<'EOF'
## Summary
- New "View full details" modal on `/admin/graph` showing the full description, all properties (un-truncated), source signals that mention the entity, related clusters, and weighted connections.
- Un-truncated existing sidebar so titles and property values wrap instead of ellipsis.
- New API handler `GET /api/admin/graph?section=node&id=<id>` backed by three FalkorDB Cypher queries (signals, clusters, connection weights). No AI calls.

Spec: `docs/superpowers/specs/2026-04-09-graph-node-detail-modal-design.md`

## Test plan
- [ ] Click a Person node → sidebar shows wrapped title and description
- [ ] Click "View full details" → modal opens with signals, clusters, connections
- [ ] Click a connection → modal closes and graph re-centers
- [ ] Node with zero signals shows empty state, not a crash
- [ ] Backdrop click / Escape / × all dismiss the modal
- [ ] Dark mode renders readable

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL**

The `gh pr create` command prints the PR URL. Report it to the user so they can trigger the OpenClaw PR review via Telegram ("Review PR #X for gold-dashboard").

---

## Self-Review Results

**Spec coverage:**
- ✅ "Full, untruncated description and properties" → Task 5 removes truncate; Task 6 renders full description + full props in modal.
- ✅ "Expose source signals" → Task 2 queries them; Task 6 renders the signals section.
- ✅ "Stay free" → No AI calls; all queries hit local FalkorDB.
- ✅ "Keep graph canvas visible" → Sidebar stays 288px; modal is portaled and backdrop-dismissed.
- ✅ Sidebar changes (un-truncate title + property values + add View full details button) → Task 5.
- ✅ New API endpoint → Task 2.
- ✅ New types → Task 1.
- ✅ Cluster chips (non-interactive in v1) → Task 6 renders them as non-interactive divs.
- ✅ Connection weights plumbed through → Task 2 returns `connectionWeights`; Task 6 merges into neighbors array.
- ✅ Empty states for zero signals / zero connections → Task 6.
- ✅ Error handling (retry button) → Task 6.
- ✅ Escape + backdrop dismissal → Task 6.
- ✅ Manual verification → Task 8.

**Placeholder scan:** No TBDs, TODOs, "similar to", or "add error handling" phrases. Every code step shows real code.

**Type consistency:**
- `NodeSignal`, `NodeClusterSummary`, `NodeDetailData` defined once in Task 1, imported and used consistently in Tasks 2, 4, 6.
- `useNodeDetail(id, enabled)` signature matches between Task 4 (definition) and Task 6 (consumer).
- `onOpenDetail: () => void` matches between Task 5 (sidebar prop) and Task 7 (caller).
- Sidebar prop additions in Task 5 are picked up by Task 7's wiring — no orphan props.

**Branch state:** Spec commit `db1b8ac` already on `feat/graph-node-detail-modal`. All tasks continue on this branch.
