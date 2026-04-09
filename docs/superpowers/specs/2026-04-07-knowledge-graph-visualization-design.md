# Knowledge Graph Visualization — Design Spec

**Date:** 2026-04-07
**Route:** `/admin/graph`
**Status:** Approved

## Overview

Interactive knowledge graph visualization for the gold-dashboard admin panel. Connects directly to the existing FalkorDB instance (`localhost:16379`) that powers the OpenClaw knowledge graph pipeline. Two views: a force-directed node-link graph for freeform exploration and a scored cluster list for trend discovery.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data access | Direct FalkorDB via `ioredis` | Co-located on VPS, same pattern as fleet file reads |
| Graph rendering | Sigma.js + Graphology + ForceAtlas2 | Purpose-built for network visualization, WebGL perf |
| Page location | Dedicated `/admin/graph` route | Graph canvas needs full viewport, doesn't fit in memory tabs |
| Interactivity | Full exploration (no editing) | Expand neighbors, search, filter, trace paths. Editing belongs in source systems. |

## Dependencies

| Package | Purpose | Scope |
|---------|---------|-------|
| `sigma` | WebGL graph renderer | client |
| `graphology` | Graph data structure | client |
| `graphology-layout-forceatlas2` | Force-directed layout | client |
| `graphology-types` | TypeScript types | dev |
| `ioredis` | Redis/FalkorDB client | server only |

## API Route: `/api/admin/graph.ts`

Single GET route with `section` query param. Direct FalkorDB connection via `ioredis` sending `GRAPH.QUERY` commands with Cypher.

### Endpoints

| Section | Params | Returns | Purpose |
|---------|--------|---------|---------|
| `overview` | — | Node counts by type, edge count, top clusters | Landing stats |
| `nodes` | `type`, `limit`, `offset` | Array of nodes with properties | Entity listing with pagination |
| `graph` | `type?`, `minScore?` | `{ nodes: [], edges: [] }` | Full graph payload for sigma |
| `neighbors` | `id`, `depth` (1-3) | `{ nodes: [], edges: [] }` | Expand from a node |
| `clusters` | `status?`, `minScore?` | Array of clusters with scores | Cluster list view |
| `cluster` | `id` | Cluster + signals + entities | Cluster detail |
| `search` | `q` | Matching nodes | Text search across entity names |

### Types

```typescript
type GraphNode = {
  id: string
  label: string        // Person, Project, Concept, etc.
  name: string
  properties: Record<string, unknown>
}

type GraphEdge = {
  source: string
  target: string
  type: string         // MENTIONS, INVOLVED_IN, etc.
  properties?: Record<string, unknown>
}

type ClusterDetail = {
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

type GraphOverview = {
  nodeCounts: Record<string, number>  // { Person: 42, Project: 15, ... }
  edgeCount: number
  topClusters: Array<{ id: string; name: string; score: number; status: string }>
}
```

### FalkorDB Connection

```typescript
import Redis from 'ioredis'

const redis = new Redis({ host: '127.0.0.1', port: 16379 })

async function graphQuery(cypher: string, params?: Record<string, unknown>) {
  const paramStr = params ? JSON.stringify(params) : ''
  const args = paramStr
    ? ['knowledge_graph', `CYPHER ${paramStr} ${cypher}`, '--compact']
    : ['knowledge_graph', cypher, '--compact']
  const result = await redis.call('GRAPH.QUERY', ...args)
  return parseGraphResult(result)
}
```

Single `ioredis` instance, lazy-initialized, reused across requests. `parseGraphResult` translates FalkorDB's compact array format (`[key, type, value]` tuples) into `GraphNode`/`GraphEdge` types.

## UI Layout

### Page Structure

New sidebar entry under Admin, between Memory and System. Two tabs: Graph (default) and Clusters.

### Graph Tab

```
+---------------------------------------------------+
|  [Search: ________]  [Filter: Person v Project v   |
|   Concept v ...]    [Depth: 1 2 3]                |
+-----------------------------------------+---------+
|                                         | Detail  |
|                                         |         |
|        Sigma.js Canvas                  | Name    |
|        (force-directed graph)           | Type    |
|                                         | Props   |
|                                         | Conns   |
|                                         |         |
+-----------------------------------------+---------+
|  Stats: 142 nodes  387 edges  12 clusters         |
+---------------------------------------------------+
```

- Canvas ~75% width. Side panel ~25%, hidden until node click (canvas full width when hidden).
- Toolbar: search input (dropdown results, select to center), entity type filter pills, depth selector (1/2/3).
- Node colors by entity type using primary palette (Person = blue, Project = green, Concept = amber, Company = violet, ActionItem = rose, Decision = teal, Cluster = orange).
- Node size scaled by connection count.
- Stats bar at bottom with current graph counts.

### Clusters Tab

```
+---------------------------------------------------+
|  [Filter: status v]  [Min score: ___]  [Sort v]   |
+---------------------------------------------------+
|  +-----------------------------------------------+|
|  | "Sports Investment Network"                    ||
|  | Score: 8.2  -  Signals: 14  -  Active          ||
|  | Key entities: Tiger 11, Sports Biz, ...        ||
|  | [Expand v]                                     ||
|  |   > Signals list (source, date, summary)       ||
|  |   > Entity pills (clickable -> Graph tab)      ||
|  +-----------------------------------------------+|
+---------------------------------------------------+
```

- Sorted by score descending by default.
- Expandable cluster cards with signals and entity pills.
- Clicking entity pill switches to Graph tab, centers on that entity, expands neighbors.

## Interaction Model

### Initial Load
1. Page mounts -> `useQuery` fetches `?section=overview` + `?section=graph&limit=200`
2. Graphology instance created, nodes + edges inserted
3. ForceAtlas2 runs ~2 seconds, stops when settled
4. Sigma renders settled graph

### Search
1. User types -> debounced 300ms -> `?section=search&q=...`
2. Dropdown results under search input
3. Select result -> sigma camera animates to node, node highlighted, side panel opens

### Node Click
1. Sigma click event -> set selected node ID in state
2. Side panel opens with properties from graphology (no fetch, already in memory)
3. Connection list from graphology neighbors

### Expand Neighbors
1. Click "Expand" in side panel or double-click node
2. Fetch `?section=neighbors&id=...&depth=N`
3. Merge new nodes/edges into graphology (skip duplicates by ID)
4. ForceAtlas2 re-runs briefly to settle new nodes
5. Sigma re-renders (watches graphology automatically)

### Filter by Type
1. Toggle type pill off -> sigma `nodeReducer` sets `hidden: true` for that label
2. Edges to hidden nodes also hidden
3. Purely client-side, no re-fetch

### Cluster -> Graph Navigation
1. Click entity pill in cluster card
2. Set active tab = Graph, pending center = entity ID
3. Graph tab checks if node exists in graphology
4. If yes -> camera animates. If no -> fetch neighbors, add to graph, then center.

### Refresh
Overview stats poll every 60s. Graph data fetched once, manipulated client-side.

## File Structure

```
routes/admin/graph.tsx              -- page component with tabs
routes/api/admin/graph.ts           -- API route (FalkorDB queries)
screens/admin/graph/
  graph-canvas.tsx                  -- sigma.js + graphology wrapper
  graph-toolbar.tsx                 -- search, filters, depth selector
  node-detail-panel.tsx             -- side panel on node click
  cluster-list.tsx                  -- clusters tab content
  cluster-card.tsx                  -- individual expandable cluster
  graph-types.ts                   -- TypeScript types
  graph-queries.ts                 -- React Query hooks + query keys
```

## FalkorDB Schema Reference

From the existing knowledge graph (`~/.openclaw/workspace/knowledge-graph/graph/schema.py`):

**Node labels:** Signal, Person, Project, Company, Concept, ActionItem, Decision, Cluster, Idea, Insight, SystemEvent, FeedbackSignal, ThresholdState, Migration

**Relationship types:** MENTIONS, MEMBER_OF, SIMILAR_TO, FOLLOWED_BY, DUPLICATE_OF, RELATES_TO, WORKS_AT, INVOLVED_IN, PARTICIPATED_IN, CRYSTALLIZED_INTO, OVERLAPS_WITH, DERIVED_FROM, CONNECTS, MADE_IN, CREATED_IN, ASSIGNED_TO

**Entity labels (primary for visualization):** Person, Project, Company, Concept, ActionItem, Decision

**Intelligence labels:** Cluster, Idea, Insight

**Signal sources:** fireflies, granola, github-stars, telegram, manual, openclaw-session
