import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'
import type { NodeStatus } from '@/screens/admin/types'

type StatusResponse = {
  ok: boolean
  error?: string
  nodeStatus?: NodeStatus & Record<string, unknown>
  sessionsList?: { sessions?: Array<Record<string, unknown>> }
}

export const Route = createFileRoute('/admin/status')({
  component: StatusPage,
})

function StatusPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.status,
    queryFn: async function fetchStatus() {
      const res = await fetch('/api/admin/status')
      if (!res.ok) throw new Error('Failed to fetch status')
      return (await res.json()) as StatusResponse
    },
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading status...</div>
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

  const node = data?.nodeStatus ?? {}
  const sessions = data?.sessionsList?.sessions ?? []
  const uptime = typeof node.uptime === 'number' ? node.uptime : 0
  const uptimeHours = Math.floor(uptime / 3600)
  const uptimeMinutes = Math.floor((uptime % 3600) / 60)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">Status</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          label="Agent Status"
          value={String(node.status ?? 'unknown')}
        />
        <StatusCard
          label="Model"
          value={String(node.model ?? '—')}
        />
        <StatusCard
          label="Version"
          value={String(node.version ?? '—')}
        />
        <StatusCard
          label="Uptime"
          value={`${uptimeHours}h ${uptimeMinutes}m`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Input Tokens"
          value={
            typeof node.tokens?.input === 'number'
              ? node.tokens.input.toLocaleString()
              : '—'
          }
        />
        <StatusCard
          label="Output Tokens"
          value={
            typeof node.tokens?.output === 'number'
              ? node.tokens.output.toLocaleString()
              : '—'
          }
        />
        <StatusCard
          label="Total Tokens"
          value={
            typeof node.tokens?.total === 'number'
              ? node.tokens.total.toLocaleString()
              : '—'
          }
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Active Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <div className="text-sm text-primary-500">No active sessions</div>
        ) : (
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Key
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Messages
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {sessions.map(function renderSession(session, i) {
                  return (
                    <tr key={String(session.key ?? i)}>
                      <td className="px-3 py-2 text-primary-900 truncate max-w-[200px] tabular-nums">
                        {String(session.friendlyId ?? session.key ?? '—')}
                      </td>
                      <td className="px-3 py-2 text-primary-700">
                        {String(session.status ?? '—')}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {String(session.messageCount ?? session.messages ?? '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
