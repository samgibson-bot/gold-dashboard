import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { formatBytes, formatUptime, formatPercent } from '@/lib/format'
import type { SystemMetrics } from '@/screens/admin/types'

type SystemResponse = {
  ok: boolean
  error?: string
  system?: SystemMetrics
}

export const Route = createFileRoute('/admin/system')({
  component: SystemPage,
})

function SystemPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.system,
    queryFn: async function fetchSystemMetrics() {
      const res = await fetch('/api/admin/system')
      if (!res.ok) throw new Error('Failed to fetch system metrics')
      return (await res.json()) as SystemResponse
    },
    refetchInterval: 15_000, // Refresh every 15 seconds
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading system metrics...</div>
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
  if (!system) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">No system data available</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">System Monitoring</h1>

      {/* System Information */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          System Information
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard label="Hostname" value={system.hostname} />
          <StatusCard label="OS" value={system.os} />
          <StatusCard label="Architecture" value={system.arch} />
          <StatusCard
            label="OpenClaw Version"
            value={system.openclawVersion ?? '—'}
          />
        </div>
      </div>

      {/* CPU */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">CPU</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatusCard
            label="Cores"
            value={system.cpu.cores}
            detail={`${system.cpu.cores} CPU core${system.cpu.cores !== 1 ? 's' : ''}`}
          />
          <StatusCard
            label="Load Average"
            value={system.cpu.loadAverage.map((v) => v.toFixed(2)).join(', ')}
            detail="1min, 5min, 15min"
          />
          {system.cpu.usage !== undefined ? (
            <div className="rounded-lg border border-primary-200 bg-surface p-4">
              <div className="text-xs text-primary-500 mb-1">CPU Usage</div>
              <div className="text-lg font-medium text-primary-950 tabular-nums mb-2">
                {formatPercent(system.cpu.usage)}
              </div>
              <ProgressBar value={system.cpu.usage} max={100} />
            </div>
          ) : (
            <StatusCard label="CPU Usage" value="—" />
          )}
        </div>
      </div>

      {/* Memory */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">Memory</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatusCard
            label="Total Memory"
            value={formatBytes(system.memory.total)}
          />
          <StatusCard
            label="Used Memory"
            value={formatBytes(system.memory.used)}
            detail={`${formatBytes(system.memory.free)} free`}
          />
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <div className="text-xs text-primary-500 mb-1">Memory Usage</div>
            <div className="text-lg font-medium text-primary-950 tabular-nums mb-2">
              {formatPercent(system.memory.usagePercent)}
            </div>
            <ProgressBar value={system.memory.usagePercent} max={100} />
          </div>
        </div>
      </div>

      {/* Disk */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">Disk Space</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatusCard label="Total Disk" value={system.disk.total} />
          <StatusCard
            label="Used Disk"
            value={system.disk.used}
            detail={`${system.disk.available} available`}
          />
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <div className="text-xs text-primary-500 mb-1">Disk Usage</div>
            <div className="text-lg font-medium text-primary-950 tabular-nums mb-2">
              {formatPercent(system.disk.usagePercent)}
            </div>
            <ProgressBar value={system.disk.usagePercent} max={100} />
          </div>
        </div>
      </div>

      {/* Uptime */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">Uptime</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusCard
            label="System Uptime"
            value={formatUptime(system.uptime.system)}
          />
          <StatusCard
            label="OpenClaw Uptime"
            value={
              system.uptime.openclaw !== undefined
                ? formatUptime(system.uptime.openclaw)
                : '—'
            }
          />
        </div>
      </div>

      {/* Gateway Health */}
      {system.gateway ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            OpenClaw Gateway
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard label="Status" value={system.gateway.status} />
            <StatusCard label="Model" value={system.gateway.model ?? '—'} />
            <StatusCard label="Version" value={system.gateway.version ?? '—'} />
            <StatusCard
              label="Active Sessions"
              value={system.gateway.sessions}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
