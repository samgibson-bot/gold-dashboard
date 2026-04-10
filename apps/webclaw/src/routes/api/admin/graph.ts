import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'
import {
  graphQuery,
  parseCompactNode,
  unwrapScalar,
} from '../../../server/falkordb'
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
            const depth = Math.min(
              Math.max(Number(url.searchParams.get('depth')) || 1, 1),
              3,
            )
            if (!id)
              return json({ ok: false, error: 'id required' }, { status: 400 })
            return await handleNeighbors(id, depth)
          }
          if (section === 'clusters') {
            const status = url.searchParams.get('status') ?? 'all'
            const minScore = Number(url.searchParams.get('minScore')) || 0
            return await handleClusters(status, minScore)
          }
          if (section === 'cluster') {
            const id = url.searchParams.get('id') ?? ''
            if (!id)
              return json({ ok: false, error: 'id required' }, { status: 400 })
            return await handleClusterDetail(id)
          }
          if (section === 'search') {
            const q = url.searchParams.get('q') ?? ''
            if (!q) return json({ ok: true, nodes: [] })
            return await handleSearch(q)
          }
          if (section === 'node') {
            const id = url.searchParams.get('id') ?? ''
            if (!id)
              return json({ ok: false, error: 'id required' }, { status: 400 })
            return await handleNodeDetail(id)
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
     RETURN labels(n)[0] AS label, count(n) AS cnt`,
  )
  const nodeCounts: Partial<Record<string, number>> = {}
  for (const row of countResult.rows) {
    const label = String(unwrapScalar(row[0]) ?? '')
    const count = Number(unwrapScalar(row[1]) ?? 0)
    if (label) nodeCounts[label] = count
  }

  const edgeResult = await graphQuery(`MATCH ()-[r]->() RETURN count(r) AS cnt`)
  const edgeCount = Number(unwrapScalar(edgeResult.rows[0]?.[0]) ?? 0)

  const clusterResult = await graphQuery(
    `MATCH (c:Cluster) RETURN c ORDER BY c.score DESC LIMIT 10`,
  )
  const topClusters: Array<ClusterSummary> = clusterResult.rows.map(
    function mapCluster(row) {
      const props = parseCompactNode(row[0]) ?? {}
      return {
        id: String(props.id ?? ''),
        name: String(props.theme ?? props.name ?? props.title ?? ''),
        score: Number(props.score ?? 0),
        status: String(props.status ?? 'unknown'),
      }
    },
  )

  const overview: GraphOverview = { nodeCounts, edgeCount, topClusters }
  return json({ ok: true, ...overview })
}

async function handleGraph(limit: number) {
  const nodeResult = await graphQuery(
    `MATCH (n) WHERE n:Person OR n:Project OR n:Company OR n:Concept OR n:ActionItem OR n:Decision
     RETURN n, labels(n)[0] AS label LIMIT ${limit}`,
  )
  const nodes: Array<GraphNode> = []
  const nodeIds = new Set<string>()
  for (const row of nodeResult.rows) {
    const props = parseCompactNode(row[0]) ?? {}
    const label = String(unwrapScalar(row[1]) ?? props._label ?? 'Unknown')
    const node = toGraphNode({ ...props, _label: label })
    if (node.id && !nodeIds.has(node.id)) {
      nodeIds.add(node.id)
      nodes.push(node)
    }
  }

  // Entities connect through shared Signals (co-occurrence), not directly
  const edgeResult = await graphQuery(
    `MATCH (a)<-[:MENTIONS]-(s:Signal)-[:MENTIONS]->(b)
     WHERE id(a) < id(b)
       AND (a:Person OR a:Project OR a:Company OR a:Concept OR a:ActionItem OR a:Decision)
       AND (b:Person OR b:Project OR b:Company OR b:Concept OR b:ActionItem OR b:Decision)
     RETURN DISTINCT a.id, b.id, count(s) AS weight LIMIT ${limit * 3}`,
  )
  const edges: Array<GraphEdge> = []
  const edgeSeen = new Set<string>()
  for (const row of edgeResult.rows) {
    const source = String(unwrapScalar(row[0]) ?? '')
    const target = String(unwrapScalar(row[1]) ?? '')
    if (source && target && nodeIds.has(source) && nodeIds.has(target)) {
      const key = `${source}::${target}`
      if (!edgeSeen.has(key)) {
        edgeSeen.add(key)
        edges.push({ source, target, type: 'CO_OCCURS' })
      }
    }
  }

  const data: GraphData = { nodes, edges }
  return json({ ok: true, ...data })
}

async function handleNeighbors(id: string, depth: number) {
  const safeId = id.replace(/'/g, "\\'")
  // Find entities connected through shared Signals (co-occurrence neighbors)
  // Depth 1 = direct co-occurrence, 2+ = co-occurrence of co-occurrences
  const nodeResult = await graphQuery(
    `MATCH (start {id: '${safeId}'})<-[:MENTIONS]-(s:Signal)-[:MENTIONS]->(neighbor)
     WHERE NOT neighbor:Signal AND neighbor.id <> '${safeId}'
     RETURN DISTINCT neighbor, labels(neighbor)[0] AS label LIMIT 50`,
  )
  const nodes: Array<GraphNode> = []
  const nodeIds = new Set<string>()
  for (const row of nodeResult.rows) {
    const props = parseCompactNode(row[0]) ?? {}
    const label = String(unwrapScalar(row[1]) ?? 'Unknown')
    const node = toGraphNode({ ...props, _label: label })
    if (node.id && !nodeIds.has(node.id)) {
      nodeIds.add(node.id)
      nodes.push(node)
    }
  }

  // Include the start node
  nodeIds.add(id)

  // Find co-occurrence edges between all returned nodes
  const allIds = [...nodeIds]
  const edges: Array<GraphEdge> = []
  const edgeSeen = new Set<string>()
  // Connect start node to each neighbor
  for (const node of nodes) {
    const key = `${id}::${node.id}`
    if (!edgeSeen.has(key)) {
      edgeSeen.add(key)
      edges.push({ source: id, target: node.id, type: 'CO_OCCURS' })
    }
  }

  // If depth > 1, also find inter-neighbor connections
  if (depth > 1 && allIds.length > 1) {
    const idList = allIds.map(function quote(i) { return `'${i.replace(/'/g, "\\'")}'` }).join(', ')
    const interResult = await graphQuery(
      `MATCH (a)<-[:MENTIONS]-(s:Signal)-[:MENTIONS]->(b)
       WHERE a.id IN [${idList}] AND b.id IN [${idList}] AND id(a) < id(b)
       RETURN DISTINCT a.id, b.id`,
    )
    for (const row of interResult.rows) {
      const source = String(unwrapScalar(row[0]) ?? '')
      const target = String(unwrapScalar(row[1]) ?? '')
      const key = [source, target].sort().join('::')
      if (source && target && !edgeSeen.has(key)) {
        edgeSeen.add(key)
        edges.push({ source, target, type: 'CO_OCCURS' })
      }
    }
  }

  return json({ ok: true, nodes, edges })
}

async function handleClusters(status: string, minScore: number) {
  const whereClause =
    status !== 'all'
      ? `WHERE c.score >= ${minScore} AND c.status = '${status.replace(/'/g, "\\'")}'`
      : `WHERE c.score >= ${minScore}`
  const result = await graphQuery(
    `MATCH (c:Cluster) ${whereClause} RETURN c ORDER BY c.score DESC LIMIT 50`,
  )
  const clusters: Array<ClusterSummary> = result.rows.map(
    function mapCluster(row) {
      const props = parseCompactNode(row[0]) ?? {}
      return {
        id: String(props.id ?? ''),
        name: String(props.theme ?? props.name ?? props.title ?? ''),
        score: Number(props.score ?? 0),
        status: String(props.status ?? 'unknown'),
        signalCount: Number(props.signal_count ?? props.signalCount ?? 0),
      }
    },
  )
  return json({ ok: true, clusters })
}

async function handleClusterDetail(id: string) {
  const safeId = id.replace(/'/g, "\\'")
  const clusterResult = await graphQuery(
    `MATCH (c:Cluster {id: '${safeId}'}) RETURN c`,
  )
  if (clusterResult.rows.length === 0) {
    return json({ ok: false, error: 'cluster not found' }, { status: 404 })
  }
  const props = parseCompactNode(clusterResult.rows[0][0]) ?? {}

  const signalResult = await graphQuery(
    `MATCH (c:Cluster {id: '${safeId}'})<-[:MEMBER_OF]-(s:Signal) RETURN s ORDER BY s.captured_at DESC LIMIT 50`,
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
     RETURN DISTINCT e, labels(e)[0] AS label LIMIT 20`,
  )
  const entities: Array<GraphNode> = entityResult.rows.map(
    function mapEntity(row) {
      const ep = parseCompactNode(row[0]) ?? {}
      const label = String(unwrapScalar(row[1]) ?? 'Unknown')
      return toGraphNode({ ...ep, _label: label })
    },
  )

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
     RETURN n, labels(n)[0] AS label LIMIT 20`,
  )
  const nodes: Array<GraphNode> = result.rows.map(function mapNode(row) {
    const props = parseCompactNode(row[0]) ?? {}
    const label = String(unwrapScalar(row[1]) ?? 'Unknown')
    return toGraphNode({ ...props, _label: label })
  })
  return json({ ok: true, nodes })
}

async function handleNodeDetail(id: string) {
  const safeId = id.replace(/'/g, "\\'")

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
