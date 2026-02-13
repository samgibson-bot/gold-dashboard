import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
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

type TokenStats = {
  totalInput: number
  totalOutput: number
  totalTokens: number
  totalCost: number
  sessionCount: number
  byModel: Record<
    string,
    {
      input: number
      output: number
      total: number
      cost: number
      inputCost: number
      outputCost: number
    }
  >
  bySession: {
    key: string
    model: string
    input: number
    output: number
    total: number
    cost: number
  }[]
}

type TokensResponse = {
  ok: boolean
  error?: string
  stats?: TokenStats
}

const TIME_RANGES = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const

const CHART_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
]

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(6)}`
  return `$${cost.toFixed(4)}`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const Route = createFileRoute('/admin/metrics')({
  component: MetricsPage,
})

function MetricsPage() {
  const [range, setRange] = useState('7d')

  const metricsQuery = useQuery({
    queryKey: adminQueryKeys.metrics(range),
    queryFn: async function fetchMetrics() {
      const res = await fetch(`/api/admin/metrics?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch metrics')
      return (await res.json()) as MetricsResponse
    },
    refetchInterval: 15_000,
  })

  const tokensQuery = useQuery({
    queryKey: adminQueryKeys.tokens,
    queryFn: async function fetchTokens() {
      const res = await fetch('/api/admin/tokens')
      if (!res.ok) throw new Error('Failed to fetch token usage')
      return (await res.json()) as TokensResponse
    },
    refetchInterval: 60_000,
  })

  const isLoading = metricsQuery.isLoading && tokensQuery.isLoading
  const error = metricsQuery.error || tokensQuery.error

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading metrics...</div>
      </div>
    )
  }

  if (error && !metricsQuery.data && !tokensQuery.data) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      </div>
    )
  }

  const metrics = metricsQuery.data?.metrics
  const kpis = metricsQuery.data?.kpis as Record<
    string,
    Record<string, unknown>
  > | null
  const stats = tokensQuery.data?.stats

  const modelEntries = stats
    ? Object.entries(stats.byModel).sort((a, b) => b[1].cost - a[1].cost)
    : []

  const pieData = modelEntries
    .filter(([, usage]) => usage.cost > 0)
    .map(([model, usage]) => ({
      name: model,
      value: usage.cost,
    }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-primary-950">Metrics</h1>
          <p className="text-sm text-primary-600 mt-1">
            Performance, tokens, and cost analytics
          </p>
        </div>

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PlaceholderCard
          label="Fleet Agents"
          value={
            kpis?.fleet
              ? String(kpis.fleet.total_agents ?? 0)
              : null
          }
          detail={
            kpis?.fleet
              ? `${kpis.fleet.active_agents ?? 0} active`
              : undefined
          }
        />
        <PlaceholderCard
          label="Outputs Today"
          value={
            kpis?.fleet
              ? String(kpis.fleet.total_outputs_today ?? 0)
              : null
          }
        />
        <PlaceholderCard
          label="Ideas"
          value={
            kpis?.ideas ? String(kpis.ideas.total ?? 0) : null
          }
          detail={
            kpis?.ideas
              ? `${kpis.ideas.in_progress ?? 0} in progress`
              : undefined
          }
        />
        <PlaceholderCard
          label="Pending Feedback"
          value={
            kpis?.fleet
              ? String(kpis.fleet.pending_feedback ?? 0)
              : null
          }
        />
      </div>

      {/* Token Usage Summary */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Token Usage
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <PlaceholderCard
            label="Total Cost"
            value={stats ? formatCost(stats.totalCost) : null}
          />
          <PlaceholderCard
            label="Total Tokens"
            value={stats ? stats.totalTokens.toLocaleString() : null}
          />
          <PlaceholderCard
            label="Input Tokens"
            value={stats ? stats.totalInput.toLocaleString() : null}
          />
          <PlaceholderCard
            label="Output Tokens"
            value={stats ? stats.totalOutput.toLocaleString() : null}
          />
          <PlaceholderCard
            label="Sessions"
            value={stats ? String(stats.sessionCount) : null}
          />
        </div>
      </div>

      {/* Cost Breakdown Pie Chart */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Cost Breakdown by Model
        </h2>
        {pieData.length > 0 ? (
          <div className="border border-primary-200 rounded-lg p-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={function renderLabel(entry) {
                      return `${entry.name}: ${formatCost(entry.value)}`
                    }}
                    labelLine={true}
                  >
                    {pieData.map(function renderCell(_, index) {
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      )
                    })}
                  </Pie>
                  <Tooltip
                    formatter={function formatTooltip(value: number) {
                      return formatCost(value)
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptySection message="No cost data available yet" />
        )}
      </div>

      {/* Cost Trend */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Cost Trend
        </h2>
        {metrics?.token_costs && metrics.token_costs.length > 0 ? (
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <SimpleBarChart data={metrics.token_costs} />
          </div>
        ) : (
          <EmptySection message="No cost trend data available yet" />
        )}
      </div>

      {/* By Model Table */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Usage by Model
        </h2>
        {modelEntries.length > 0 ? (
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Model
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Input
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Output
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {modelEntries.map(function renderModel([model, usage]) {
                  return (
                    <tr key={model}>
                      <td className="px-3 py-2 text-primary-900">{model}</td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {usage.input.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {usage.output.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {usage.total.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums font-medium">
                        {formatCost(usage.cost)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptySection message="No model usage data available yet" />
        )}
      </div>

      {/* By Session Table */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Usage by Session
        </h2>
        {stats && stats.bySession.length > 0 ? (
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Session
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Model
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Input
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Output
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {stats.bySession.map(function renderSession(entry) {
                  return (
                    <tr key={entry.key}>
                      <td className="px-3 py-2 text-primary-900 truncate max-w-[200px]">
                        {entry.key}
                      </td>
                      <td className="px-3 py-2 text-primary-700 truncate max-w-[150px]">
                        {entry.model}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {entry.input.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {entry.output.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {entry.total.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums font-medium">
                        {formatCost(entry.cost)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptySection message="No session usage data available yet" />
        )}
      </div>

      {/* Fleet Utilization */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Fleet Utilization
        </h2>
        {metrics?.fleet_utilization && metrics.fleet_utilization.length > 0 ? (
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
        ) : (
          <EmptySection message="No fleet utilization data available yet" />
        )}
      </div>
    </div>
  )
}

function PlaceholderCard(props: {
  label: string
  value: string | null
  detail?: string
}) {
  return (
    <div className="rounded-lg border border-primary-200 bg-surface p-4">
      <div className="text-xs text-primary-500">{props.label}</div>
      {props.value !== null ? (
        <>
          <div className="text-lg font-medium text-primary-950 tabular-nums mt-1">
            {props.value}
          </div>
          {props.detail ? (
            <div className="text-xs text-primary-500 mt-0.5">
              {props.detail}
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-sm text-primary-300 mt-1">&mdash;</div>
      )}
    </div>
  )
}

function EmptySection(props: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-primary-200 bg-primary-50/50 p-6 text-center">
      <p className="text-sm text-primary-400">{props.message}</p>
    </div>
  )
}

function SimpleBarChart(props: { data: Array<MetricPoint> }) {
  const max = Math.max(
    ...props.data.map(function getVal(d) {
      return d.value
    }),
    1,
  )

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
