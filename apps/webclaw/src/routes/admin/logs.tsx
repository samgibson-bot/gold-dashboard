import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { LogEntry } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'

type LogsResponse = {
  ok: boolean
  error?: string
  logs?: {
    entries?: Array<LogEntry>
  }
}

const LOG_LEVELS = [
  'all',
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const

const levelColors: Record<string, string> = {
  trace: 'text-primary-400',
  debug: 'text-primary-500',
  info: 'text-blue-600',
  warn: 'text-yellow-600',
  error: 'text-red-600',
  fatal: 'text-red-800 font-medium',
}

export const Route = createFileRoute('/admin/logs')({
  component: LogsPage,
})

function LogsPage() {
  const [level, setLevel] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.logs(level),
    queryFn: async function fetchLogs() {
      const params = new URLSearchParams({ limit: '200' })
      if (level !== 'all') params.set('level', level)
      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      return (await res.json()) as LogsResponse
    },
    refetchInterval: autoRefresh ? 10_000 : false,
  })

  const entries = data?.logs?.entries ?? []

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-primary-950">Logs</h1>
        <div className="flex items-center gap-3">
          <select
            value={level}
            onChange={function handleLevelChange(e) {
              setLevel(e.target.value)
            }}
            className="text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface text-primary-900"
          >
            {LOG_LEVELS.map(function renderLevel(l) {
              return (
                <option key={l} value={l}>
                  {l === 'all' ? 'All Levels' : l.toUpperCase()}
                </option>
              )
            })}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-primary-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={function handleAutoRefreshChange(e) {
                setAutoRefresh(e.target.checked)
              }}
              className="rounded"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading logs...</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-primary-500">No log entries</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto border border-primary-200 rounded-lg bg-primary-50">
          <div className="p-3 space-y-0.5 font-mono text-xs">
            {entries.map(function renderEntry(entry, i) {
              return (
                <div key={`${entry.timestamp}-${i}`} className="flex gap-2">
                  <span className="text-primary-400 tabular-nums shrink-0">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleTimeString()
                      : '—'}
                  </span>
                  <span
                    className={cn(
                      'uppercase w-12 shrink-0',
                      levelColors[entry.level] ?? 'text-primary-500',
                    )}
                  >
                    {entry.level}
                  </span>
                  {entry.source ? (
                    <span className="text-primary-400 shrink-0">
                      [{entry.source}]
                    </span>
                  ) : null}
                  <span className="text-primary-900 break-all">
                    {entry.message}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
