# Knowledge Graph Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive knowledge graph visualization page at `/admin/graph` that connects directly to FalkorDB and lets users explore nodes, relationships, and clusters.

**Architecture:** New `/admin/graph` route with two tabs — a Sigma.js + Graphology force-directed graph for node-link exploration, and a scored cluster list for trend discovery. API route connects directly to FalkorDB via `ioredis` on `localhost:16379`. No gateway RPC dependency.

**Tech Stack:** Sigma.js, Graphology, ForceAtlas2, ioredis, TanStack Router, TanStack Query, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-07-knowledge-graph-visualization-design.md`

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/webclaw/package.json`

- [ ] **Step 1: Install client-side graph packages**

```bash
pnpm -C apps/webclaw add sigma graphology graphology-layout-forceatlas2
```

- [ ] **Step 2: Install graphology types**

```bash
pnpm -C apps/webclaw add -D graphology-types
```

- [ ] **Step 3: Install ioredis for FalkorDB**

```bash
pnpm -C apps/webclaw add ioredis
```

- [ ] **Step 4: Verify build still passes**

```bash
pnpm -C apps/webclaw build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/webclaw/package.json pnpm-lock.yaml
git commit -m "chore: add sigma, graphology, ioredis for knowledge graph"
```

---

### Task 2: Types and query keys

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/graph-types.ts`
- Modify: `apps/webclaw/src/screens/admin/admin-queries.ts`

- [ ] **Step 1: Create graph types file**

Create `apps/webclaw/src/screens/admin/graph/graph-types.ts`:

```typescript
export type GraphNode = {
  id: string
  label: string
  name: string
  properties: Record<string, unknown>
}

export type GraphEdge = {
  source: string
  target: string
  type: string
  properties?: Record<string, unknown>
}

export type GraphData = {
  nodes: Array<GraphNode>
  edges: Array<GraphEdge>
}

export type ClusterSummary = {
  id: string
  name: string
  score: number
  status: string
  signalCount?: number
}

export type ClusterDetail = {
  id: string
  name: string
  score: number
  status: string
  signals: Array<{
    id: string
    source: string
    title: string
    captured_at: string
    digest: string
  }>
  entities: Array<GraphNode>
}

export type GraphOverview = {
  nodeCounts: Partial<Record<string, number>>
  edgeCount: number
  topClusters: Array<ClusterSummary>
}

export const ENTITY_LABELS = [
  'Person',
  'Project',
  'Company',
  'Concept',
  'ActionItem',
  'Decision',
] as const

export const ENTITY_COLORS: Record<string, string> = {
  Person: '#3b82f6',
  Project: '#22c55e',
  Company: '#8b5cf6',
  Concept: '#f59e0b',
  ActionItem: '#f43f5e',
  Decision: '#14b8a6',
  Cluster: '#f97316',
  Idea: '#ec4899',
  Insight: '#06b6d4',
  Signal: '#6b7280',
}
```

- [ ] **Step 2: Add graph query keys to admin-queries.ts**

In `apps/webclaw/src/screens/admin/admin-queries.ts`, add these entries to the `adminQueryKeys` object:

```typescript
graph: ['admin', 'graph'] as const,
graphOverview: ['admin', 'graph', 'overview'] as const,
graphData: ['admin', 'graph', 'data'] as const,
graphClusters: function graphClusters(status?: string) {
  return ['admin', 'graph', 'clusters', status ?? 'all'] as const
},
graphCluster: function graphCluster(id: string) {
  return ['admin', 'graph', 'cluster', id] as const
},
graphSearch: function graphSearch(q: string) {
  return ['admin', 'graph', 'search', q] as const
},
graphNeighbors: function graphNeighbors(id: string, depth: number) {
  return ['admin', 'graph', 'neighbors', id, depth] as const
},
```

- [ ] **Step 3: Verify build**

```bash
pnpm -C apps/webclaw build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/graph-types.ts apps/webclaw/src/screens/admin/admin-queries.ts
git commit -m "feat(graph): add types and query keys"
```

---

### Task 3: FalkorDB client and API route

**Files:**
- Create: `apps/webclaw/src/server/falkordb.ts`
- Create: `apps/webclaw/src/routes/api/admin/graph.ts`

- [ ] **Step 1: Create FalkorDB client helper**

Create `apps/webclaw/src/server/falkordb.ts`:

```typescript
import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({ host: '127.0.0.1', port: 16379, lazyConnect: true })
    redis.on('error', function onError(err) {
      console.error('[falkordb] connection error:', err.message)
    })
  }
  return redis
}

type FalkorResult = {
  headers: Array<string>
  rows: Array<Array<unknown>>
}

function parseCompactNode(raw: unknown): Record<string, unknown> | null {
  if (!Array.isArray(raw)) return null
  // FalkorDB compact format: [[properties], [labels], id]
  // Properties are [[name, type, value], ...]
  const props: Record<string, unknown> = {}
  const properties = raw[0]
  if (Array.isArray(properties)) {
    for (const prop of properties) {
      if (Array.isArray(prop) && prop.length >= 3) {
        props[prop[0] as string] = prop[2]
      }
    }
  }
  return props
}

function parseResultSet(raw: unknown): FalkorResult {
  if (!Array.isArray(raw) || raw.length < 2) {
    return { headers: [], rows: [] }
  }
  const headerRow = raw[0]
  const dataRows = raw[1]
  const headers: Array<string> = Array.isArray(headerRow)
    ? headerRow.map(function extractName(h: unknown) {
        if (Array.isArray(h)) return String(h[1] ?? h[0] ?? '')
        return String(h ?? '')
      })
    : []
  const rows: Array<Array<unknown>> = Array.isArray(dataRows) ? dataRows : []
  return { headers, rows }
}

export async function graphQuery(cypher: string): Promise<FalkorResult> {
  const r = getRedis()
  const result = await r.call('GRAPH.QUERY', 'knowledge_graph', cypher, '--compact')
  return parseResultSet(result)
}

export { parseCompactNode }
```

- [ ] **Step 2: Create API route**

Create `apps/webclaw/src/routes/api/admin/graph.ts`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { graphQuery, parseCompactNode } from '../../../server/falkordb'
import { sanitizeError } from '../../../server/errors'
import type {
  ClusterDetail,
  ClusterSummary,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphOverview,
} from '../../../screens/admin/graph/graph-types'

function toGraphNode(props: Record<string, unknown>): GraphNode {
  return {
    id: String(props.id ?? props.name ?? ''),
    label: String(props._label ?? props.label ?? 'Unknown'),
    name: String(props.name ?? props.title ?? props.id ?? ''),
    properties: props,
  }
}

export const Route = createFileRoute('/api/admin/graph')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const section = url.searchParams.get('section') ?? 'overview'

          if (section === 'overview') {
            return await handleOverview()
          }
          if (section === 'graph') {
            const limit = Number(url.searchParams.get('limit')) || 200
            return await handleGraph(limit)
          }
          if (section === 'neighbors') {
            const id = url.searchParams.get('id') ?? ''
            const depth = Math.min(Math.max(Number(url.searchParams.get('depth')) || 1, 1), 3)
            if (!id) return json({ ok: false, error: 'id required' }, { status: 400 })
            return await handleNeighbors(id, depth)
          }
          if (section === 'clusters') {
            const status = url.searchParams.get('status') ?? 'all'
            const minScore = Number(url.searchParams.get('minScore')) || 0
            return await handleClusters(status, minScore)
          }
          if (section === 'cluster') {
            const id = url.searchParams.get('id') ?? ''
            if (!id) return json({ ok: false, error: 'id required' }, { status: 400 })
            return await handleClusterDetail(id)
          }
          if (section === 'search') {
            const q = url.searchParams.get('q') ?? ''
            if (!q) return json({ ok: true, nodes: [] })
            return await handleSearch(q)
          }

          return json({ ok: false, error: 'unknown section' }, { status: 400 })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})

async function handleOverview() {
  const countResult = await graphQuery(
    `MATCH (n) WHERE n:Person OR n:Project OR n:Company OR n:Concept OR n:ActionItem OR n:Decision OR n:Cluster OR n:Idea OR n:Insight
     RETURN labels(n)[0] AS label, count(n) AS cnt`
  )
  const nodeCounts: Partial<Record<string, number>> = {}
  for (const row of countResult.rows) {
    const label = String(row[0] ?? '')
    const count = Number(row[1] ?? 0)
    if (label) nodeCounts[label] = count
  }

  const edgeResult = await graphQuery(`MATCH ()-[r]->() RETURN count(r) AS cnt`)
  const edgeCount = Number(edgeResult.rows[0]?.[0] ?? 0)

  const clusterResult = await graphQuery(
    `MATCH (c:Cluster) RETURN c ORDER BY c.score DESC LIMIT 10`
  )
  const topClusters: Array<ClusterSummary> = clusterResult.rows.map(function mapCluster(row) {
    const props = parseCompactNode(row[0]) ?? {}
    return {
      id: String(props.id ?? ''),
      name: String(props.name ?? props.title ?? ''),
      score: Number(props.score ?? 0),
      status: String(props.status ?? 'unknown'),
    }
  })

  const overview: GraphOverview = { nodeCounts, edgeCount, topClusters }
  return json({ ok: true, ...overview })
}

async function handleGraph(limit: number) {
  const nodeResult = await graphQuery(
    `MATCH (n) WHERE n:Person OR n:Project OR n:Company OR n:Concept OR n:ActionItem OR n:Decision
     RETURN n, labels(n)[0] AS label LIMIT ${limit}`
  )
  const nodes: Array<GraphNode> = []
  const nodeIds = new Set<string>()
  for (const row of nodeResult.rows) {
    const props = parseCompactNode(row[0]) ?? {}
    const label = String(row[1] ?? props._label ?? 'Unknown')
    const node = toGraphNode({ ...props, _label: label })
    if (node.id && !nodeIds.has(node.id)) {
      nodeIds.add(node.id)
      nodes.push(node)
    }
  }

  const edgeResult = await graphQuery(
    `MATCH (a)-[r]->(b)
     WHERE (a:Person OR a:Project OR a:Company OR a:Concept OR a:ActionItem OR a:Decision)
       AND (b:Person OR b:Project OR b:Company OR b:Concept OR b:ActionItem OR b:Decision)
     RETURN a.id, type(r), b.id LIMIT ${limit * 3}`
  )
  const edges: Array<GraphEdge> = []
  for (const row of edgeResult.rows) {
    const source = String(row[0] ?? '')
    const type = String(row[1] ?? '')
    const target = String(row[2] ?? '')
    if (source && target && nodeIds.has(source) && nodeIds.has(target)) {
      edges.push({ source, target, type })
    }
  }

  const data: GraphData = { nodes, edges }
  return json({ ok: true, ...data })
}

async function handleNeighbors(id: string, depth: number) {
  const safeId = id.replace(/'/g, "\\'")
  const nodeResult = await graphQuery(
    `MATCH (start {id: '${safeId}'})-[*1..${depth}]-(connected)
     RETURN DISTINCT connected, labels(connected)[0] AS label LIMIT 50`
  )
  const nodes: Array<GraphNode> = []
  const nodeIds = new Set<string>()
  for (const row of nodeResult.rows) {
    const props = parseCompactNode(row[0]) ?? {}
    const label = String(row[1] ?? 'Unknown')
    const node = toGraphNode({ ...props, _label: label })
    if (node.id && !nodeIds.has(node.id)) {
      nodeIds.add(node.id)
      nodes.push(node)
    }
  }

  // Include the start node
  nodeIds.add(id)

  const edgeResult = await graphQuery(
    `MATCH (start {id: '${safeId}'})-[*1..${depth}]-(connected)
     WITH collect(DISTINCT connected) + collect(DISTINCT start) AS allNodes
     UNWIND allNodes AS a
     MATCH (a)-[r]-(b) WHERE b IN allNodes
     RETURN DISTINCT a.id, type(r), b.id`
  )
  const edges: Array<GraphEdge> = []
  const edgeSeen = new Set<string>()
  for (const row of edgeResult.rows) {
    const source = String(row[0] ?? '')
    const type = String(row[1] ?? '')
    const target = String(row[2] ?? '')
    const edgeKey = [source, type, target].sort().join('::')
    if (source && target && !edgeSeen.has(edgeKey)) {
      edgeSeen.add(edgeKey)
      edges.push({ source, target, type })
    }
  }

  return json({ ok: true, nodes, edges })
}

async function handleClusters(status: string, minScore: number) {
  const whereClause = status !== 'all'
    ? `WHERE c.score >= ${minScore} AND c.status = '${status.replace(/'/g, "\\'")}'`
    : `WHERE c.score >= ${minScore}`
  const result = await graphQuery(
    `MATCH (c:Cluster) ${whereClause} RETURN c ORDER BY c.score DESC LIMIT 50`
  )
  const clusters: Array<ClusterSummary> = result.rows.map(function mapCluster(row) {
    const props = parseCompactNode(row[0]) ?? {}
    return {
      id: String(props.id ?? ''),
      name: String(props.name ?? props.title ?? ''),
      score: Number(props.score ?? 0),
      status: String(props.status ?? 'unknown'),
      signalCount: Number(props.signal_count ?? props.signalCount ?? 0),
    }
  })
  return json({ ok: true, clusters })
}

async function handleClusterDetail(id: string) {
  const safeId = id.replace(/'/g, "\\'")
  const clusterResult = await graphQuery(
    `MATCH (c:Cluster {id: '${safeId}'}) RETURN c`
  )
  if (clusterResult.rows.length === 0) {
    return json({ ok: false, error: 'cluster not found' }, { status: 404 })
  }
  const props = parseCompactNode(clusterResult.rows[0]![0]) ?? {}

  const signalResult = await graphQuery(
    `MATCH (c:Cluster {id: '${safeId}'})<-[:MEMBER_OF]-(s:Signal) RETURN s ORDER BY s.captured_at DESC LIMIT 50`
  )
  const signals = signalResult.rows.map(function mapSignal(row) {
    const sp = parseCompactNode(row[0]) ?? {}
    return {
      id: String(sp.id ?? ''),
      source: String(sp.source ?? ''),
      title: String(sp.title ?? sp.raw_summary ?? ''),
      captured_at: String(sp.captured_at ?? ''),
      digest: String(sp.digest ?? sp.key_insight ?? ''),
    }
  })

  const entityResult = await graphQuery(
    `MATCH (c:Cluster {id: '${safeId}'})<-[:MEMBER_OF]-(s:Signal)-[:MENTIONS]->(e)
     WHERE e:Person OR e:Project OR e:Company OR e:Concept
     RETURN DISTINCT e, labels(e)[0] AS label LIMIT 20`
  )
  const entities: Array<GraphNode> = entityResult.rows.map(function mapEntity(row) {
    const ep = parseCompactNode(row[0]) ?? {}
    const label = String(row[1] ?? 'Unknown')
    return toGraphNode({ ...ep, _label: label })
  })

  const detail: ClusterDetail = {
    id: String(props.id ?? ''),
    name: String(props.name ?? props.title ?? ''),
    score: Number(props.score ?? 0),
    status: String(props.status ?? 'unknown'),
    signals,
    entities,
  }
  return json({ ok: true, ...detail })
}

async function handleSearch(q: string) {
  // FalkorDB doesn't have full-text by default, use CONTAINS on name
  const safeQ = q.replace(/'/g, "\\'").toLowerCase()
  const result = await graphQuery(
    `MATCH (n) WHERE toLower(n.name) CONTAINS '${safeQ}'
     RETURN n, labels(n)[0] AS label LIMIT 20`
  )
  const nodes: Array<GraphNode> = result.rows.map(function mapNode(row) {
    const props = parseCompactNode(row[0]) ?? {}
    const label = String(row[1] ?? 'Unknown')
    return toGraphNode({ ...props, _label: label })
  })
  return json({ ok: true, nodes })
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm -C apps/webclaw build
```

Expected: Build succeeds. The route is auto-discovered by TanStack Router's file-based routing.

- [ ] **Step 4: Commit**

```bash
git add apps/webclaw/src/server/falkordb.ts apps/webclaw/src/routes/api/admin/graph.ts
git commit -m "feat(graph): add FalkorDB client and API route"
```

---

### Task 4: React Query hooks

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/graph-queries.ts`

- [ ] **Step 1: Create query hooks file**

Create `apps/webclaw/src/screens/admin/graph/graph-queries.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import type {
  ClusterDetail,
  ClusterSummary,
  GraphData,
  GraphNode,
  GraphOverview,
} from './graph-types'

async function fetchGraph(section: string, params?: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ section, ...params })
  const res = await fetch(`/api/admin/graph?${query}`)
  if (!res.ok) throw new Error(`Graph API error: ${res.status}`)
  return res.json()
}

export function useGraphOverview() {
  return useQuery({
    queryKey: adminQueryKeys.graphOverview,
    queryFn: async function fetchOverview() {
      const data = (await fetchGraph('overview')) as { ok: boolean } & GraphOverview
      return data
    },
    refetchInterval: 60_000,
  })
}

export function useGraphData(limit = 200) {
  return useQuery({
    queryKey: adminQueryKeys.graphData,
    queryFn: async function fetchGraphData() {
      const data = (await fetchGraph('graph', { limit: String(limit) })) as { ok: boolean } & GraphData
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useGraphNeighbors(id: string, depth: number, enabled: boolean) {
  return useQuery({
    queryKey: adminQueryKeys.graphNeighbors(id, depth),
    queryFn: async function fetchNeighbors() {
      const data = (await fetchGraph('neighbors', {
        id,
        depth: String(depth),
      })) as { ok: boolean } & GraphData
      return data
    },
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useGraphClusters(status = 'all', minScore = 0) {
  return useQuery({
    queryKey: adminQueryKeys.graphClusters(status),
    queryFn: async function fetchClusters() {
      const data = (await fetchGraph('clusters', {
        status,
        minScore: String(minScore),
      })) as { ok: boolean; clusters: Array<ClusterSummary> }
      return data.clusters
    },
    staleTime: 60_000,
  })
}

export function useClusterDetail(id: string, enabled: boolean) {
  return useQuery({
    queryKey: adminQueryKeys.graphCluster(id),
    queryFn: async function fetchCluster() {
      const data = (await fetchGraph('cluster', { id })) as { ok: boolean } & ClusterDetail
      return data
    },
    enabled,
    staleTime: 60_000,
  })
}

export function useGraphSearch(q: string) {
  return useQuery({
    queryKey: adminQueryKeys.graphSearch(q),
    queryFn: async function fetchSearch() {
      const data = (await fetchGraph('search', { q })) as { ok: boolean; nodes: Array<GraphNode> }
      return data.nodes
    },
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm -C apps/webclaw build
```

- [ ] **Step 3: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/graph-queries.ts
git commit -m "feat(graph): add React Query hooks for graph data"
```

---

### Task 5: Sigma.js graph canvas component

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/graph-canvas.tsx`

- [ ] **Step 1: Create the sigma wrapper component**

Create `apps/webclaw/src/screens/admin/graph/graph-canvas.tsx`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import Graph from 'graphology'
import Sigma from 'sigma'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { cn } from '@/lib/utils'
import type { GraphData, GraphNode } from './graph-types'
import { ENTITY_COLORS } from './graph-types'

type GraphCanvasProps = {
  data: GraphData | undefined
  selectedNode: string | null
  onNodeClick: (node: GraphNode | null) => void
  onNodeExpand: (nodeId: string) => void
  hiddenLabels: Set<string>
  pendingCenter: string | null
  onCenterComplete: () => void
}

export function GraphCanvas({
  data,
  selectedNode,
  onNodeClick,
  onNodeExpand,
  hiddenLabels,
  pendingCenter,
  onCenterComplete,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

  // Initialize graph + sigma
  useEffect(
    function initSigma() {
      if (!containerRef.current || !data) return

      const graph = new Graph()
      graphRef.current = graph

      for (const node of data.nodes) {
        if (!graph.hasNode(node.id)) {
          graph.addNode(node.id, {
            label: node.name,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 6,
            color: ENTITY_COLORS[node.label] ?? '#6b7280',
            nodeLabel: node.label,
            nodeData: node,
          })
        }
      }

      for (const edge of data.edges) {
        if (
          graph.hasNode(edge.source) &&
          graph.hasNode(edge.target) &&
          !graph.hasEdge(edge.source, edge.target)
        ) {
          graph.addEdge(edge.source, edge.target, {
            type: edge.type,
            color: '#d1d5db',
            size: 1,
          })
        }
      }

      // Scale node size by degree
      graph.forEachNode(function scaleSize(nodeId) {
        const degree = graph.degree(nodeId)
        graph.setNodeAttribute(nodeId, 'size', Math.max(4, Math.min(20, 4 + degree * 1.5)))
      })

      // Run ForceAtlas2 layout
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 1,
          scalingRatio: 2,
          barnesHutOptimize: graph.order > 100,
        },
      })

      const sigma = new Sigma(graph, containerRef.current, {
        renderLabels: true,
        labelRenderedSizeThreshold: 8,
        defaultEdgeColor: '#d1d5db',
        labelColor: { color: '#374151' },
        nodeReducer: function reduceNode(node, attrs) {
          const res = { ...attrs }
          const label = attrs.nodeLabel as string
          if (hiddenLabels.has(label)) {
            res.hidden = true
          }
          if (selectedNode === node) {
            res.highlighted = true
            res.zIndex = 1
          }
          return res
        },
        edgeReducer: function reduceEdge(_edge, attrs, source, target) {
          const res = { ...attrs }
          const sourceLabel = graph.getNodeAttribute(source, 'nodeLabel') as string
          const targetLabel = graph.getNodeAttribute(target, 'nodeLabel') as string
          if (hiddenLabels.has(sourceLabel) || hiddenLabels.has(targetLabel)) {
            res.hidden = true
          }
          return res
        },
      })

      sigma.on('clickNode', function handleClick({ node }) {
        const nodeData = graph.getNodeAttribute(node, 'nodeData') as GraphNode
        onNodeClick(nodeData)
      })

      sigma.on('doubleClickNode', function handleDblClick({ node }) {
        onNodeExpand(node)
      })

      sigma.on('clickStage', function handleStageClick() {
        onNodeClick(null)
      })

      sigmaRef.current = sigma
      setNodeCount(graph.order)
      setEdgeCount(graph.size)

      return function cleanup() {
        sigma.kill()
        sigmaRef.current = null
        graphRef.current = null
      }
    },
    [data],
  )

  // Update reducers when filters/selection change
  useEffect(
    function refreshReducers() {
      if (sigmaRef.current) {
        sigmaRef.current.refresh()
      }
    },
    [hiddenLabels, selectedNode],
  )

  // Handle pending center (from cluster navigation)
  useEffect(
    function handlePendingCenter() {
      if (!pendingCenter || !sigmaRef.current || !graphRef.current) return
      const graph = graphRef.current
      const sigma = sigmaRef.current

      if (graph.hasNode(pendingCenter)) {
        const attrs = graph.getNodeAttributes(pendingCenter)
        sigma.getCamera().animate(
          { x: attrs.x as number, y: attrs.y as number, ratio: 0.3 },
          { duration: 600 },
        )
        const nodeData = graph.getNodeAttribute(pendingCenter, 'nodeData') as GraphNode
        onNodeClick(nodeData)
      }
      onCenterComplete()
    },
    [pendingCenter, onCenterComplete, onNodeClick],
  )

  // Public method: merge new nodes/edges (for neighbor expansion)
  const mergeData = useCallback(function mergeData(newData: GraphData) {
    const graph = graphRef.current
    if (!graph) return

    for (const node of newData.nodes) {
      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id, {
          label: node.name,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 6,
          color: ENTITY_COLORS[node.label] ?? '#6b7280',
          nodeLabel: node.label,
          nodeData: node,
        })
      }
    }

    for (const edge of newData.edges) {
      if (
        graph.hasNode(edge.source) &&
        graph.hasNode(edge.target) &&
        !graph.hasEdge(edge.source, edge.target)
      ) {
        graph.addEdge(edge.source, edge.target, {
          type: edge.type,
          color: '#d1d5db',
          size: 1,
        })
      }
    }

    // Re-scale sizes
    graph.forEachNode(function scaleSize(nodeId) {
      const degree = graph.degree(nodeId)
      graph.setNodeAttribute(nodeId, 'size', Math.max(4, Math.min(20, 4 + degree * 1.5)))
    })

    // Brief re-layout
    forceAtlas2.assign(graph, {
      iterations: 50,
      settings: { gravity: 1, scalingRatio: 2, barnesHutOptimize: true },
    })

    setNodeCount(graph.order)
    setEdgeCount(graph.size)
  }, [])

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className={cn('h-full w-full bg-primary-50 rounded-lg')} />
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-primary-500 tabular-nums">
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges</span>
      </div>
    </div>
  )
}
```

Note: The `mergeData` function is exposed via the component but will be called through a ref from the parent. We will wire this in Task 8.

- [ ] **Step 2: Verify build**

```bash
pnpm -C apps/webclaw build
```

- [ ] **Step 3: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/graph-canvas.tsx
git commit -m "feat(graph): add sigma.js graph canvas component"
```

---

### Task 6: Graph toolbar component

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/graph-toolbar.tsx`

- [ ] **Step 1: Create toolbar with search, type filters, and depth selector**

Create `apps/webclaw/src/screens/admin/graph/graph-toolbar.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useGraphSearch } from './graph-queries'
import { ENTITY_COLORS, ENTITY_LABELS } from './graph-types'
import type { GraphNode } from './graph-types'

type GraphToolbarProps = {
  hiddenLabels: Set<string>
  onToggleLabel: (label: string) => void
  depth: number
  onDepthChange: (depth: number) => void
  onSelectSearchResult: (node: GraphNode) => void
}

export function GraphToolbar({
  hiddenLabels,
  onToggleLabel,
  depth,
  onDepthChange,
  onSelectSearchResult,
}: GraphToolbarProps) {
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(
    function debounceSearch() {
      const timer = setTimeout(function apply() {
        setDebouncedSearch(searchText)
      }, 300)
      return function cancel() {
        clearTimeout(timer)
      }
    },
    [searchText],
  )

  useEffect(
    function handleClickOutside() {
      function onClickOutside(e: MouseEvent) {
        if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
          setShowResults(false)
        }
      }
      document.addEventListener('mousedown', onClickOutside)
      return function cleanup() {
        document.removeEventListener('mousedown', onClickOutside)
      }
    },
    [],
  )

  const searchResults = useGraphSearch(debouncedSearch)

  function handleSelectResult(node: GraphNode) {
    onSelectSearchResult(node)
    setShowResults(false)
    setSearchText('')
    setDebouncedSearch('')
  }

  return (
    <div className="flex items-center gap-4 rounded-lg bg-primary-100 p-3">
      {/* Search */}
      <div ref={searchRef} className="relative min-w-48">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchText}
          onChange={function onInput(e) {
            setSearchText(e.target.value)
            setShowResults(true)
          }}
          onFocus={function onFocus() {
            if (debouncedSearch.length >= 2) setShowResults(true)
          }}
          className="w-full rounded-md border border-primary-300 bg-primary-50 px-3 py-1.5 text-sm text-primary-900 placeholder:text-primary-400 focus:border-primary-500 focus:outline-none"
        />
        {showResults && searchResults.data && searchResults.data.length > 0 && (
          <div className="absolute top-full z-50 mt-1 max-h-60 w-72 overflow-y-auto rounded-md border border-primary-300 bg-primary-50 shadow-lg">
            {searchResults.data.map(function renderResult(node) {
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={function select() {
                    handleSelectResult(node)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-200"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ENTITY_COLORS[node.label] ?? '#6b7280' }}
                  />
                  <span className="truncate text-primary-900">{node.name}</span>
                  <span className="ml-auto text-xs text-primary-500">{node.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {ENTITY_LABELS.map(function renderPill(label) {
          const active = !hiddenLabels.has(label)
          return (
            <button
              key={label}
              type="button"
              onClick={function toggle() {
                onToggleLabel(label)
              }}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity',
                active ? 'opacity-100' : 'opacity-40',
              )}
              style={{
                backgroundColor: active
                  ? ENTITY_COLORS[label] + '20'
                  : undefined,
                color: ENTITY_COLORS[label],
                border: `1px solid ${ENTITY_COLORS[label]}40`,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Depth selector */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-primary-500">Depth</span>
        {[1, 2, 3].map(function renderDepth(d) {
          return (
            <button
              key={d}
              type="button"
              onClick={function select() {
                onDepthChange(d)
              }}
              className={cn(
                'h-7 w-7 rounded text-xs font-medium',
                d === depth
                  ? 'bg-primary-900 text-primary-50'
                  : 'bg-primary-200 text-primary-600 hover:bg-primary-300',
              )}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm -C apps/webclaw build
```

- [ ] **Step 3: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/graph-toolbar.tsx
git commit -m "feat(graph): add toolbar with search, type filters, depth"
```

---

### Task 7: Node detail panel

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx`

- [ ] **Step 1: Create node detail side panel**

Create `apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx`:

```typescript
import { cn } from '@/lib/utils'
import { ENTITY_COLORS } from './graph-types'
import type { GraphNode } from './graph-types'

type NodeDetailPanelProps = {
  node: GraphNode | null
  neighbors: Array<{ id: string; name: string; label: string; relationship: string }>
  onClose: () => void
  onExpand: (nodeId: string) => void
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
])

export function NodeDetailPanel({
  node,
  neighbors,
  onClose,
  onExpand,
  onNavigateToNode,
}: NodeDetailPanelProps) {
  if (!node) return null

  const displayProps = Object.entries(node.properties).filter(function filterProps([key]) {
    return !SKIP_PROPERTIES.has(key)
  })

  return (
    <div className="flex h-full w-72 flex-col border-l border-primary-200 bg-primary-50">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-primary-200 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-primary-900">{node.name}</h3>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ENTITY_COLORS[node.label] ?? '#6b7280' }}
            />
            <span className="text-xs text-primary-500">{node.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-primary-400 hover:text-primary-600"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Expand button */}
      <div className="border-b border-primary-200 p-3">
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

      {/* Properties */}
      {displayProps.length > 0 && (
        <div className="border-b border-primary-200 p-4">
          <h4 className="mb-2 text-xs font-medium text-primary-500">Properties</h4>
          <dl className="space-y-1.5">
            {displayProps.map(function renderProp([key, value]) {
              return (
                <div key={key} className="flex gap-2 text-xs">
                  <dt className="shrink-0 text-primary-500">{key}</dt>
                  <dd className="truncate text-primary-800">{formatValue(value)}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {/* Connections */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="mb-2 text-xs font-medium text-primary-500">
          Connections ({neighbors.length})
        </h4>
        <div className="space-y-1">
          {neighbors.map(function renderNeighbor(n) {
            return (
              <button
                key={`${n.id}-${n.relationship}`}
                type="button"
                onClick={function navigate() {
                  onNavigateToNode(n.id)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-primary-200"
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ENTITY_COLORS[n.label] ?? '#6b7280' }}
                />
                <span className="truncate text-primary-800">{n.name}</span>
                <span className="ml-auto shrink-0 text-primary-400">{n.relationship}</span>
              </button>
            )
          })}
          {neighbors.length === 0 && (
            <p className="text-xs text-primary-400">No connections found</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm -C apps/webclaw build
```

- [ ] **Step 3: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/node-detail-panel.tsx
git commit -m "feat(graph): add node detail side panel"
```

---

### Task 8: Cluster list and cluster card

**Files:**
- Create: `apps/webclaw/src/screens/admin/graph/cluster-card.tsx`
- Create: `apps/webclaw/src/screens/admin/graph/cluster-list.tsx`

- [ ] **Step 1: Create cluster card component**

Create `apps/webclaw/src/screens/admin/graph/cluster-card.tsx`:

```typescript
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useClusterDetail } from './graph-queries'
import { ENTITY_COLORS } from './graph-types'
import type { ClusterSummary } from './graph-types'

type ClusterCardProps = {
  cluster: ClusterSummary
  onNavigateToEntity: (entityId: string) => void
}

export function ClusterCard({ cluster, onNavigateToEntity }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false)
  const detail = useClusterDetail(cluster.id, expanded)

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50">
      <button
        type="button"
        onClick={function toggle() {
          setExpanded(!expanded)
        }}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-primary-900">{cluster.name || 'Unnamed cluster'}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-primary-500">
            <span className="tabular-nums">Score: {cluster.score.toFixed(1)}</span>
            {cluster.signalCount ? (
              <span className="tabular-nums">Signals: {cluster.signalCount}</span>
            ) : null}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5',
                cluster.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-primary-200 text-primary-600',
              )}
            >
              {cluster.status}
            </span>
          </div>
        </div>
        <svg
          className={cn('h-4 w-4 text-primary-400 transition-transform', expanded && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-primary-200 p-4">
          {detail.isLoading && (
            <p className="text-xs text-primary-400">Loading...</p>
          )}
          {detail.data && (
            <div className="space-y-3">
              {/* Entities */}
              {detail.data.entities.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium text-primary-500">Entities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.data.entities.map(function renderEntity(entity) {
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          onClick={function navigate() {
                            onNavigateToEntity(entity.id)
                          }}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:opacity-80"
                          style={{
                            backgroundColor: (ENTITY_COLORS[entity.label] ?? '#6b7280') + '20',
                            color: ENTITY_COLORS[entity.label] ?? '#6b7280',
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: ENTITY_COLORS[entity.label] ?? '#6b7280' }}
                          />
                          {entity.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Signals */}
              {detail.data.signals.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium text-primary-500">Signals</h4>
                  <div className="space-y-1.5">
                    {detail.data.signals.map(function renderSignal(signal) {
                      return (
                        <div key={signal.id} className="rounded bg-primary-100 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary-700">{signal.source}</span>
                            {signal.captured_at && (
                              <span className="text-primary-400">
                                {new Date(Number(signal.captured_at) * 1000).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-primary-600 text-pretty">
                            {signal.digest || signal.title}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create cluster list component**

Create `apps/webclaw/src/screens/admin/graph/cluster-list.tsx`:

```typescript
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useGraphClusters } from './graph-queries'
import { ClusterCard } from './cluster-card'

type ClusterListProps = {
  onNavigateToEntity: (entityId: string) => void
}

export function ClusterList({ onNavigateToEntity }: ClusterListProps) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [minScore, setMinScore] = useState(0)
  const [sortBy, setSortBy] = useState<'score' | 'signals'>('score')

  const clustersQuery = useGraphClusters(statusFilter, minScore)
  const clusters = clustersQuery.data ?? []

  const sorted = [...clusters].sort(function compare(a, b) {
    if (sortBy === 'signals') return (b.signalCount ?? 0) - (a.signalCount ?? 0)
    return b.score - a.score
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg bg-primary-100 p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-primary-500">Status</label>
          <select
            value={statusFilter}
            onChange={function onSelect(e) {
              setStatusFilter(e.target.value)
            }}
            className="rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-800"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="crystallized">Crystallized</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-primary-500">Min score</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={minScore}
            onChange={function onInput(e) {
              setMinScore(Number(e.target.value))
            }}
            className="w-16 rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-800 tabular-nums"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-primary-500">Sort</label>
          <select
            value={sortBy}
            onChange={function onSelect(e) {
              setSortBy(e.target.value as 'score' | 'signals')
            }}
            className="rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-800"
          >
            <option value="score">Score</option>
            <option value="signals">Signals</option>
          </select>
        </div>
      </div>

      {/* List */}
      {clustersQuery.isLoading && (
        <p className="py-8 text-center text-sm text-primary-400">Loading clusters...</p>
      )}
      {!clustersQuery.isLoading && sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-primary-400">No clusters found</p>
      )}
      <div className="space-y-3">
        {sorted.map(function renderCluster(cluster) {
          return (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              onNavigateToEntity={onNavigateToEntity}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm -C apps/webclaw build
```

- [ ] **Step 4: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/cluster-card.tsx apps/webclaw/src/screens/admin/graph/cluster-list.tsx
git commit -m "feat(graph): add cluster list and cluster card components"
```

---

### Task 9: Main graph page, sidebar entry, and wiring

**Files:**
- Create: `apps/webclaw/src/routes/admin/graph.tsx`
- Modify: `apps/webclaw/src/components/nav-sections.ts`

- [ ] **Step 1: Add sidebar navigation entry**

In `apps/webclaw/src/components/nav-sections.ts`, add an import for a graph icon and a new nav item. First read the file to find the correct location — the entry should go in the section that contains `Memory`. Add:

```typescript
{ to: '/admin/graph', label: 'Graph', icon: <appropriate-graph-icon> },
```

Place it after the Memory entry. Use an icon from `@hugeicons/core-free-icons` — check availability with: `grep -r "Graph" node_modules/.pnpm/@hugeicons+core-free-icons*/` or use `Share01Icon` / `NodeIcon` / `Connect04Icon` as a fallback. If no graph-specific icon exists, `MindMapping01Icon` or `Workflow03Icon` are good alternatives.

- [ ] **Step 2: Create main graph page**

Create `apps/webclaw/src/routes/admin/graph.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useGraphData, useGraphOverview } from '@/screens/admin/graph/graph-queries'
import { GraphCanvas } from '@/screens/admin/graph/graph-canvas'
import { GraphToolbar } from '@/screens/admin/graph/graph-toolbar'
import { NodeDetailPanel } from '@/screens/admin/graph/node-detail-panel'
import { ClusterList } from '@/screens/admin/graph/cluster-list'
import type { GraphData, GraphNode } from '@/screens/admin/graph/graph-types'

export const Route = createFileRoute('/admin/graph')({
  component: GraphPage,
})

function GraphPage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'clusters'>('graph')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set())
  const [depth, setDepth] = useState(1)
  const [pendingCenter, setPendingCenter] = useState<string | null>(null)
  const canvasRef = useRef<{ mergeData: (data: GraphData) => void }>(null)

  const overview = useGraphOverview()
  const graphData = useGraphData()

  const handleNodeClick = useCallback(function handleNodeClick(node: GraphNode | null) {
    setSelectedNode(node)
  }, [])

  const handleNodeExpand = useCallback(
    async function handleNodeExpand(nodeId: string) {
      const query = new URLSearchParams({
        section: 'neighbors',
        id: nodeId,
        depth: String(depth),
      })
      const res = await fetch(`/api/admin/graph?${query}`)
      if (!res.ok) return
      const data = (await res.json()) as { ok: boolean } & GraphData
      if (data.ok && canvasRef.current) {
        canvasRef.current.mergeData(data)
      }
    },
    [depth],
  )

  function handleToggleLabel(label: string) {
    setHiddenLabels(function toggle(prev) {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  function handleSelectSearchResult(node: GraphNode) {
    setActiveTab('graph')
    setPendingCenter(node.id)
    setSelectedNode(node)
  }

  function handleNavigateToEntity(entityId: string) {
    setActiveTab('graph')
    setPendingCenter(entityId)
  }

  function handleNavigateToNode(nodeId: string) {
    setPendingCenter(nodeId)
  }

  const handleCenterComplete = useCallback(function handleCenterComplete() {
    setPendingCenter(null)
  }, [])

  // Build neighbors list from graphology data for the detail panel
  // This is a simplified version — the real neighbor data comes from the canvas
  const neighbors: Array<{ id: string; name: string; label: string; relationship: string }> = []

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium text-primary-900">Knowledge Graph</h1>
        <p className="text-sm text-primary-500">
          Explore entities, relationships, and clusters from your knowledge graph
        </p>
      </div>

      {/* Overview stats */}
      {overview.data && (
        <div className="flex gap-4">
          {Object.entries(overview.data.nodeCounts).map(function renderStat([label, count]) {
            return (
              <div key={label} className="rounded-lg bg-primary-100 px-3 py-2">
                <div className="text-lg font-medium text-primary-900 tabular-nums">{count}</div>
                <div className="text-xs text-primary-500">{label}s</div>
              </div>
            )
          })}
          <div className="rounded-lg bg-primary-100 px-3 py-2">
            <div className="text-lg font-medium text-primary-900 tabular-nums">
              {overview.data.edgeCount}
            </div>
            <div className="text-xs text-primary-500">Edges</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary-200">
        {(['graph', 'clusters'] as const).map(function renderTab(tab) {
          return (
            <button
              key={tab}
              type="button"
              onClick={function selectTab() {
                setActiveTab(tab)
              }}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-primary-900 text-primary-900'
                  : 'border-transparent text-primary-500 hover:text-primary-700',
              )}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'graph' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <GraphToolbar
            hiddenLabels={hiddenLabels}
            onToggleLabel={handleToggleLabel}
            depth={depth}
            onDepthChange={setDepth}
            onSelectSearchResult={handleSelectSearchResult}
          />
          <div className="flex min-h-0 flex-1 gap-0">
            <GraphCanvas
              data={graphData.data}
              selectedNode={selectedNode?.id ?? null}
              onNodeClick={handleNodeClick}
              onNodeExpand={handleNodeExpand}
              hiddenLabels={hiddenLabels}
              pendingCenter={pendingCenter}
              onCenterComplete={handleCenterComplete}
            />
            <NodeDetailPanel
              node={selectedNode}
              neighbors={neighbors}
              onClose={function close() {
                setSelectedNode(null)
              }}
              onExpand={handleNodeExpand}
              onNavigateToNode={handleNavigateToNode}
            />
          </div>
        </div>
      )}

      {activeTab === 'clusters' && (
        <ClusterList onNavigateToEntity={handleNavigateToEntity} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update routeTree.gen.ts if needed**

Run the dev server briefly or build to trigger TanStack Router's codegen:

```bash
pnpm -C apps/webclaw build
```

If the build fails because the route tree doesn't include the new graph route, manually add the import and route config to `apps/webclaw/src/routeTree.gen.ts` following the pattern of other admin routes (fleet, memory, etc.).

- [ ] **Step 4: Verify full build passes**

```bash
pnpm -C apps/webclaw build
```

Expected: Build succeeds, new route is registered.

- [ ] **Step 5: Commit**

```bash
git add apps/webclaw/src/routes/admin/graph.tsx apps/webclaw/src/components/nav-sections.ts apps/webclaw/src/routeTree.gen.ts
git commit -m "feat(graph): add graph page with sidebar entry and full wiring"
```

---

### Task 10: Expose mergeData via ref and wire neighbor expansion

**Files:**
- Modify: `apps/webclaw/src/screens/admin/graph/graph-canvas.tsx`
- Modify: `apps/webclaw/src/routes/admin/graph.tsx`

The `GraphCanvas` component has a `mergeData` function but it's not exposed to the parent. We need to use `useImperativeHandle` + `forwardRef` so the parent can call `canvasRef.current.mergeData(data)`.

- [ ] **Step 1: Add forwardRef and useImperativeHandle to GraphCanvas**

In `apps/webclaw/src/screens/admin/graph/graph-canvas.tsx`:

1. Import `forwardRef` and `useImperativeHandle` from React
2. Change the component to use `forwardRef`
3. Expose `mergeData` via `useImperativeHandle`

Add after the `mergeData` useCallback:

```typescript
useImperativeHandle(ref, function exposeApi() {
  return { mergeData }
}, [mergeData])
```

Wrap the component export with `forwardRef`:

```typescript
export const GraphCanvas = forwardRef(function GraphCanvas(
  props: GraphCanvasProps,
  ref: React.ForwardedRef<{ mergeData: (data: GraphData) => void }>,
) {
  // ... existing component body, using props instead of destructured params
})
```

- [ ] **Step 2: Wire neighbor data into NodeDetailPanel**

In `apps/webclaw/src/routes/admin/graph.tsx`, replace the empty `neighbors` array with a function that reads from the graphology instance. Add a ref to access graphology from the canvas, or compute neighbors from the selected node using the graph data.

Simpler approach — derive neighbors from graphData when a node is selected:

```typescript
const neighbors = selectedNode && graphData.data
  ? graphData.data.edges
      .filter(function isConnected(e) {
        return e.source === selectedNode.id || e.target === selectedNode.id
      })
      .map(function toNeighbor(e) {
        const otherId = e.source === selectedNode.id ? e.target : e.source
        const otherNode = graphData.data!.nodes.find(function match(n) {
          return n.id === otherId
        })
        return {
          id: otherId,
          name: otherNode?.name ?? otherId,
          label: otherNode?.label ?? 'Unknown',
          relationship: e.type,
        }
      })
  : []
```

Replace the `const neighbors: Array<...> = []` line with the above.

- [ ] **Step 3: Verify build**

```bash
pnpm -C apps/webclaw build
```

- [ ] **Step 4: Commit**

```bash
git add apps/webclaw/src/screens/admin/graph/graph-canvas.tsx apps/webclaw/src/routes/admin/graph.tsx
git commit -m "feat(graph): wire up neighbor expansion and detail panel data"
```

---

### Task 11: Lint, build, and push

**Files:**
- Potentially all new/modified files

- [ ] **Step 1: Run lint and format check**

```bash
pnpm -C apps/webclaw check
```

- [ ] **Step 2: Stage any formatting changes**

```bash
git add -A
```

- [ ] **Step 3: Commit formatting if needed**

```bash
git diff --cached --quiet || git commit -m "style: apply linter formatting"
```

- [ ] **Step 4: Final build verification**

```bash
pnpm -C apps/webclaw build
```

Expected: Clean build with no errors.

- [ ] **Step 5: Push and create PR**

```bash
git push origin HEAD
```

Then create PR:

```bash
gh pr create --title "feat: [Graph] Knowledge graph visualization" --body "$(cat <<'EOF'
## Summary
- New `/admin/graph` page with interactive knowledge graph visualization
- Direct FalkorDB connection via ioredis for real-time graph data
- Two tabs: force-directed graph explorer (Sigma.js) and scored cluster list
- Search, type filters, neighbor expansion (1-3 hops), node detail panel
- Cluster-to-graph navigation for trend exploration

## Tech
- Sigma.js + Graphology + ForceAtlas2 for WebGL graph rendering
- ioredis for FalkorDB queries (localhost:16379)
- React Query for data fetching with 60s overview polling

## Test plan
- [ ] Verify FalkorDB connection works on VPS (graph data loads)
- [ ] Click nodes to see detail panel
- [ ] Double-click or "Expand" to load neighbors
- [ ] Search for an entity by name
- [ ] Toggle type filter pills to hide/show node types
- [ ] Switch to Clusters tab, expand a cluster, click entity pill to navigate back to graph
- [ ] Verify sidebar nav link appears between Memory and System
EOF
)"
```
