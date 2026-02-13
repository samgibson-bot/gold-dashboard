import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import type { MetricPoint } from '@/screens/admin/types'

type MetricsResponse = {
  ok: boolean
  error?: string
  metrics?: {
    throughput: Array<MetricPoint>
    cycle_time: Array<MetricPoint>
    token_costs: Array<MetricPoint>
    fleet_utilization: Array<{ agent: string; hours: number }>
  }
  kpis?: Record<string, unknown>
  tokens?: Record<string, unknown>
}

const TIME_RANGES = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const

export const Route = createFileRoute('/admin/metrics')({
  component: MetricsPage,
})

function MetricsPage() {
  const [range, setRange] = useState('7d')

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.metrics(range),
    queryFn: async function fetchMetrics() {
      const res = await fetch(`/api/admin/metrics?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch metrics')
      return (await res.json()) as MetricsResponse
    },
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading metrics...</div>
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

  const metrics = data?.metrics
  const kpis = data?.kpis as Record<string, Record<string, unknown>> | null
  const tokens = data?.tokens as Record<string, unknown> | null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-primary-950">Metrics</h1>
          <p className="text-sm text-primary-600 mt-1">
            Performance and cost analytics
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex gap-1">
          {TIME_RANGES.map(function renderRange(r) {
            return (
              <button
                key={r.value}
                onClick={function handleRange() {
                  setRange(r.value)
                }}
                className={cn(
                  'text-xs px-3 py-1.5 rounded font-medium transition-colors',
                  range === r.value
                    ? 'bg-primary-900 text-white'
                    : 'bg-primary-100 text-primary-600 hover:bg-primary-200',
                )}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPI Cards */}
      {kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Fleet Agents"
            value={String(kpis.fleet?.total_agents ?? 0)}
            detail={`${kpis.fleet?.active_agents ?? 0} active`}
          />
          <KPICard
            label="Outputs Today"
            value={String(kpis.fleet?.total_outputs_today ?? 0)}
          />
          <KPICard
            label="Ideas"
            value={String(kpis.ideas?.total ?? 0)}
            detail={`${kpis.ideas?.in_progress ?? 0} in progress`}
          />
          <KPICard
            label="Pending Feedback"
            value={String(kpis.fleet?.pending_feedback ?? 0)}
          />
        </div>
      ) : null}

      {/* Token Cost Summary */}
      {tokens ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Token Usage
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Tokens"
              value={formatNumber(Number(tokens.totalTokens ?? 0))}
            />
            <KPICard
              label="Total Cost"
              value={`$${Number(tokens.totalCost ?? 0).toFixed(4)}`}
            />
            <KPICard
              label="Input Tokens"
              value={formatNumber(Number(tokens.inputTokens ?? 0))}
            />
            <KPICard
              label="Output Tokens"
              value={formatNumber(Number(tokens.outputTokens ?? 0))}
            />
          </div>
        </div>
      ) : null}

      {/* Token Cost Chart */}
      {metrics?.token_costs && metrics.token_costs.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Cost Trend
          </h2>
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <SimpleBarChart data={metrics.token_costs} />
          </div>
        </div>
      ) : null}

      {/* Fleet Utilization */}
      {metrics?.fleet_utilization && metrics.fleet_utilization.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Fleet Utilization
          </h2>
          <div className="space-y-2">
            {metrics.fleet_utilization.map(function renderUtil(u) {
              return (
                <div
                  key={u.agent}
                  className="rounded-lg border border-primary-200 bg-surface p-3 flex items-center gap-3"
                >
                  <div className="text-sm font-medium text-primary-900 w-24 capitalize">
                    {u.agent}
                  </div>
                  <div className="flex-1 bg-primary-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 rounded-full h-2"
                      style={{ width: `${Math.min(100, u.hours * 10)}%` }}
                    />
                  </div>
                  <div className="text-xs text-primary-500 tabular-nums w-16 text-right">
                    {u.hours}h
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function KPICard(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-primary-200 bg-surface p-4">
      <div className="text-xs text-primary-500">{props.label}</div>
      <div className="text-lg font-medium text-primary-950 tabular-nums mt-1">
        {props.value}
      </div>
      {props.detail ? (
        <div className="text-xs text-primary-500 mt-0.5">{props.detail}</div>
      ) : null}
    </div>
  )
}

function SimpleBarChart(props: { data: Array<MetricPoint> }) {
  const max = Math.max(...props.data.map(function getVal(d) { return d.value }), 1)

  return (
    <div className="flex items-end gap-1 h-32">
      {props.data.map(function renderBar(point, i) {
        const height = (point.value / max) * 100
        return (
          <div
            key={`${point.date}-${i}`}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full bg-blue-400 rounded-t min-h-[2px]"
              style={{ height: `${height}%` }}
              title={`${point.date}: ${point.value}`}
            />
            <div className="text-[8px] text-primary-400 truncate w-full text-center">
              {point.date.slice(-5)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
