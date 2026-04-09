export const adminQueryKeys = {
  status: ['admin', 'status'] as const,
  tokens: ['admin', 'tokens'] as const,
  logs: function logs(level?: string) {
    return ['admin', 'logs', level ?? 'all'] as const
  },
  cron: ['admin', 'cron'] as const,
  config: ['admin', 'config'] as const,
  browser: ['admin', 'browser'] as const,
  ideas: ['admin', 'ideas'] as const,
  fleet: ['admin', 'fleet'] as const,
  memory: ['admin', 'memory'] as const,
  activity: ['admin', 'activity'] as const,
  approvals: ['admin', 'approvals'] as const,
  metrics: function metrics(range?: string) {
    return ['admin', 'metrics', range ?? '7d'] as const
  },
  webhooks: ['admin', 'webhooks'] as const,
  workflows: ['admin', 'workflows'] as const,
  skills: ['admin', 'skills'] as const,
  files: function files(path?: string) {
    return ['admin', 'files', path ?? '.openclaw'] as const
  },
  cronRuns: function cronRuns(jobId: string) {
    return ['admin', 'cron', 'runs', jobId] as const
  },
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
} as const
