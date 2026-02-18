import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { SystemMetrics } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { formatBytes, formatPercent, formatUptime } from '@/lib/format'

type CombinedStatusResponse = {
  ok: boolean
  error?: string
  system?: SystemMetrics
  sessions?: Array<Record<string, unknown>>
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
      return (await res.json()) as CombinedStatusResponse
    },
    refetchInterval: 15_000,
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

  const system = data?.system
  const sessions = data?.sessions ?? []

  if (!system) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">No data available</div>
      </div>
    )
  }

  const gateway = system.gateway

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">System Status</h1>

      {/* Gateway Status - Most Important */}
      {gateway && (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            OpenClaw Gateway
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatusCard label="Status" value={gateway.status} />
            <StatusCard label="Model" value={gateway.model ?? '—'} />
            <StatusCard label="Version" value={gateway.version ?? '—'} />
            <StatusCard
              label="Uptime"
              value={
                system.uptime.openclaw !== undefined
                  ? formatUptime(system.uptime.openclaw)
                  : '—'
              }
            />
            <StatusCard label="Active Sessions" value={gateway.sessions} />
          </div>
        </div>
      )}

      {/* System Resources - Compact Layout */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          System Resources
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CPU */}
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <div className="text-xs text-primary-500 mb-1">CPU</div>
            <div className="text-lg font-medium text-primary-950 tabular-nums mb-2">
              {system.cpu.usage !== undefined
                ? formatPercent(system.cpu.usage)
                : '—'}
            </div>
            {system.cpu.usage !== undefined && (
              <ProgressBar
                value={system.cpu.usage}
                max={100}
                className="mb-2"
              />
            )}
            <div className="text-xs text-primary-600">
              {system.cpu.cores} cores • Load:{' '}
              {system.cpu.loadAverage[0].toFixed(2)}
            </div>
          </div>

          {/* Memory */}
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <div className="text-xs text-primary-500 mb-1">Memory</div>
            <div className="text-lg font-medium text-primary-950 tabular-nums mb-2">
              {formatBytes(system.memory.used)} /{' '}
              {formatBytes(system.memory.total)}
            </div>
            <ProgressBar
              value={system.memory.usagePercent}
              max={100}
              className="mb-2"
            />
            <div className="text-xs text-primary-600">
              {formatPercent(system.memory.usagePercent)} used
            </div>
          </div>

          {/* Disk */}
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <div className="text-xs text-primary-500 mb-1">Disk Space</div>
            <div className="text-lg font-medium text-primary-950 tabular-nums mb-2">
              {system.disk.used} / {system.disk.total}
            </div>
            <ProgressBar
              value={system.disk.usagePercent}
              max={100}
              className="mb-2"
            />
            <div className="text-xs text-primary-600">
              {system.disk.available} available
            </div>
          </div>
        </div>
      </div>

      {/* System Info - Compact */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          System Information
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard
            label="Hostname"
            value={system.hostname}
            detail={system.arch}
          />
          <StatusCard label="OS" value={system.os} />
          <StatusCard
            label="System Uptime"
            value={formatUptime(system.uptime.system)}
          />
          <StatusCard
            label="OpenClaw Version"
            value={system.openclawVersion ?? '—'}
          />
        </div>
      </div>

      {/* Active Sessions Table */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Active Sessions ({sessions.length})
          </h2>
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Session
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
                        {String(
                          session.messageCount ?? session.messages ?? '—',
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
