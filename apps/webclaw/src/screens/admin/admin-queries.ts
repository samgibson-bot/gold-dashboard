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
} as const
