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
