import { useQuery } from '@tanstack/react-query'
import type {
  ClusterDetail,
  ClusterSummary,
  GraphData,
  GraphNode,
  GraphOverview,
} from './graph-types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'

async function fetchGraph(
  section: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const query = new URLSearchParams({ section, ...params })
  const res = await fetch(`/api/admin/graph?${query}`)
  if (!res.ok) throw new Error(`Graph API error: ${res.status}`)
  return res.json()
}

export function useGraphOverview() {
  return useQuery({
    queryKey: adminQueryKeys.graphOverview,
    queryFn: async function fetchOverview() {
      const data = (await fetchGraph('overview')) as {
        ok: boolean
      } & GraphOverview
      return data
    },
    refetchInterval: 60_000,
  })
}

export function useGraphData(limit = 200) {
  return useQuery({
    queryKey: adminQueryKeys.graphData,
    queryFn: async function fetchGraphData() {
      const data = (await fetchGraph('graph', { limit: String(limit) })) as {
        ok: boolean
      } & GraphData
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
      const data = (await fetchGraph('cluster', { id })) as {
        ok: boolean
      } & ClusterDetail
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
      const data = (await fetchGraph('search', { q })) as {
        ok: boolean
        nodes: Array<GraphNode>
      }
      return data.nodes
    },
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
