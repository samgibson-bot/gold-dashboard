export const adminQueryKeys = {
  status: ['admin', 'status'] as const,
  system: ['admin', 'system'] as const,
  tokens: ['admin', 'tokens'] as const,
  logs: function logs(level?: string) {
    return ['admin', 'logs', level ?? 'all'] as const
  },
  cron: ['admin', 'cron'] as const,
  config: ['admin', 'config'] as const,
  browser: ['admin', 'browser'] as const,
  missions: ['admin', 'missions'] as const,
} as const
