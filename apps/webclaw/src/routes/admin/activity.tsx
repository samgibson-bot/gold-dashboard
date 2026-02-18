import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ActivityEvent } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'

type ActivityResponse = {
  ok: boolean
  error?: string
  events?: Array<ActivityEvent>
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  gateway: 'bg-blue-100 text-blue-700',
  github: 'bg-primary-100 text-primary-700',
  cron: 'bg-amber-100 text-amber-700',
  agent: 'bg-purple-100 text-purple-700',
  feedback: 'bg-green-100 text-green-700',
  system: 'bg-primary-100 text-primary-600',
}

const EVENT_TYPES = [
  'all',
  'gateway',
  'agent',
  'feedback',
  'cron',
  'github',
] as const

export const Route = createFileRoute('/admin/activity')({
  component: ActivityPage,
})

function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: [...adminQueryKeys.activity, typeFilter],
    queryFn: async function fetchActivity() {
      const params = typeFilter !== 'all' ? `?type=${typeFilter}` : ''
      const res = await fetch(`/api/admin/activity${params}`)
      if (!res.ok) throw new Error('Failed to fetch activity')
      return (await res.json()) as ActivityResponse
    },
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading activity...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      </div>
    )
  }

  const events = data?.events ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-medium text-primary-950">Activity Feed</h1>
        <p className="text-sm text-primary-600 mt-1">
          Unified feed of gateway, agent, and system events
        </p>
      </div>

      {/* Type Filter */}
      <div className="flex gap-1.5">
        {EVENT_TYPES.map(function renderFilter(type) {
          return (
            <button
              key={type}
              onClick={function handleFilter() {
                setTypeFilter(type)
              }}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors capitalize',
                typeFilter === type
                  ? 'bg-primary-900 text-white'
                  : 'bg-primary-100 text-primary-600 hover:bg-primary-200',
              )}
            >
              {type}
            </button>
          )
        })}
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-sm text-primary-400">
          No activity events
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(function renderEvent(event) {
            return (
              <div
                key={event.id}
                className="rounded-lg border border-primary-200 bg-surface p-3 flex items-start gap-3"
              >
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5',
                    EVENT_TYPE_COLORS[event.type] ?? EVENT_TYPE_COLORS.system,
                  )}
                >
                  {event.type}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary-900">
                    {event.summary}
                  </div>
                  {event.agent ? (
                    <div className="text-xs text-primary-500 mt-0.5">
                      Agent: {event.agent}
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-primary-400 flex-shrink-0 tabular-nums">
                  {formatTimestamp(event.timestamp)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60_000)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`

    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`

    return date.toLocaleDateString()
  } catch {
    return ts
  }
}
