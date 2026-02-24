import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type React from 'react'
import type { MetricPoint } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'

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

type OpenRouterBalance = {
  usage: number
  usage_daily: number
  usage_weekly: number
  usage_monthly: number
  limit: number | null
  limit_remaining: number | null
}

type ModelUsage = {
  usage: number
  requests: number
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
  provider_name: string
}

type ActivityItem = {
  date: string
  model: string
  provider_name: string
  usage: number
  requests: number
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
}

type TokensResponse = {
  ok: boolean
  error?: string
  balance: OpenRouterBalance | null
  byModel: Record<string, ModelUsage>
  costByDay: Array<{ date: string; value: number }>
  activity: Array<ActivityItem>
}

type SortDir = 'asc' | 'desc'
type ModelSortCol = 'model' | 'requests' | 'input' | 'output' | 'cost'
type CallSortCol = 'date' | 'model' | 'requests' | 'input' | 'output' | 'cost'

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


export const Route = createFileRoute('/admin/metrics')({
  component: MetricsPage,
})

function MetricsPage() {
  const [range, setRange] = useState('7d')
  const [modelSort, setModelSort] = useState<{ col: ModelSortCol; dir: SortDir }>({ col: 'cost', dir: 'desc' })
  const [callSort, setCallSort] = useState<{ col: CallSortCol; dir: SortDir }>({ col: 'date', dir: 'desc' })

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
  const balance = tokensQuery.data?.balance
  const byModel = tokensQuery.data?.byModel ?? {}
  const allCostByDay = tokensQuery.data?.costByDay ?? []

  const rangedays =
    range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - rangedays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const costByDay = allCostByDay.filter(function filterDay(d) {
    return d.date >= cutoffStr
  })

  const rawModelEntries = Object.entries(byModel)

  function handleModelSort(col: ModelSortCol) {
    setModelSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' },
    )
  }

  function handleCallSort(col: CallSortCol) {
    setCallSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' },
    )
  }

  const modelEntries = [...rawModelEntries].sort((a, b) => {
    const [am, au] = a
    const [bm, bu] = b
    let cmp = 0
    if (modelSort.col === 'model') cmp = am.localeCompare(bm)
    else if (modelSort.col === 'requests') cmp = au.requests - bu.requests
    else if (modelSort.col === 'input') cmp = au.prompt_tokens - bu.prompt_tokens
    else if (modelSort.col === 'output') cmp = au.completion_tokens - bu.completion_tokens
    else cmp = au.usage - bu.usage
    return modelSort.dir === 'asc' ? cmp : -cmp
  })

  const allActivity = tokensQuery.data?.activity ?? []
  const filteredActivity = allActivity.filter((item) => item.date >= cutoffStr)

  const sortedActivity = [...filteredActivity].sort((a, b) => {
    let cmp = 0
    if (callSort.col === 'date') cmp = a.date.localeCompare(b.date)
    else if (callSort.col === 'model') cmp = a.model.localeCompare(b.model)
    else if (callSort.col === 'requests') cmp = a.requests - b.requests
    else if (callSort.col === 'input') cmp = a.prompt_tokens - b.prompt_tokens
    else if (callSort.col === 'output') cmp = a.completion_tokens - b.completion_tokens
    else cmp = a.usage - b.usage
    return callSort.dir === 'asc' ? cmp : -cmp
  })

  const pieData = rawModelEntries
    .filter(([, u]) => u.usage > 0)
    .map(([model, u]) => ({
      name: model,
      value: u.usage,
    }))

  const totalCost = Object.values(byModel).reduce((s, m) => s + m.usage, 0)
  const totalTokens = Object.values(byModel).reduce(
    (s, m) => s + m.prompt_tokens + m.completion_tokens + m.reasoning_tokens,
    0,
  )
  const totalRequests = Object.values(byModel).reduce(
    (s, m) => s + m.requests,
    0,
  )

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
          value={kpis?.fleet ? String(kpis.fleet.total_agents ?? 0) : null}
          detail={
            kpis?.fleet ? `${kpis.fleet.active_agents ?? 0} active` : undefined
          }
        />
        <PlaceholderCard
          label="Outputs Today"
          value={
            kpis?.fleet ? String(kpis.fleet.total_outputs_today ?? 0) : null
          }
        />
        <PlaceholderCard
          label="Ideas"
          value={kpis?.ideas ? String(kpis.ideas.total ?? 0) : null}
          detail={
            kpis?.ideas
              ? `${kpis.ideas.in_progress ?? 0} in progress`
              : undefined
          }
        />
        <PlaceholderCard
          label="Pending Feedback"
          value={kpis?.fleet ? String(kpis.fleet.pending_feedback ?? 0) : null}
        />
      </div>

      {/* Token Usage Summary */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Token Usage
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <PlaceholderCard
            label="Total Cost (30d)"
            value={tokensQuery.data ? formatCost(totalCost) : null}
          />
          <PlaceholderCard
            label="Today"
            value={balance ? formatCost(balance.usage_daily) : null}
          />
          <PlaceholderCard
            label="This Month"
            value={balance ? formatCost(balance.usage_monthly) : null}
          />
          <PlaceholderCard
            label="Total Tokens"
            value={tokensQuery.data ? totalTokens.toLocaleString() : null}
          />
          <PlaceholderCard
            label="Requests"
            value={tokensQuery.data ? totalRequests.toLocaleString() : null}
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
        {costByDay.length > 0 ? (
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <SimpleBarChart data={costByDay} />
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
                  <SortTh align="left" active={modelSort.col === 'model'} dir={modelSort.dir} onClick={function () { handleModelSort('model') }}>Model</SortTh>
                  <SortTh align="right" active={modelSort.col === 'requests'} dir={modelSort.dir} onClick={function () { handleModelSort('requests') }}>Requests</SortTh>
                  <SortTh align="right" active={modelSort.col === 'input'} dir={modelSort.dir} onClick={function () { handleModelSort('input') }}>Input</SortTh>
                  <SortTh align="right" active={modelSort.col === 'output'} dir={modelSort.dir} onClick={function () { handleModelSort('output') }}>Output</SortTh>
                  <SortTh align="right" active={modelSort.col === 'cost'} dir={modelSort.dir} onClick={function () { handleModelSort('cost') }}>Cost</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {modelEntries.map(function renderModel([model, u]) {
                  return (
                    <tr key={model}>
                      <td className="px-3 py-2 text-primary-900">{model}</td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {u.requests.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {u.prompt_tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {u.completion_tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums font-medium">
                        {formatCost(u.usage)}
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

      {/* Usage by Call */}
      <div>
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Usage by Call
        </h2>
        {sortedActivity.length > 0 ? (
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <SortTh align="left" active={callSort.col === 'date'} dir={callSort.dir} onClick={function () { handleCallSort('date') }}>Date</SortTh>
                  <SortTh align="left" active={callSort.col === 'model'} dir={callSort.dir} onClick={function () { handleCallSort('model') }}>Model</SortTh>
                  <SortTh align="right" active={callSort.col === 'requests'} dir={callSort.dir} onClick={function () { handleCallSort('requests') }}>Requests</SortTh>
                  <SortTh align="right" active={callSort.col === 'input'} dir={callSort.dir} onClick={function () { handleCallSort('input') }}>Input</SortTh>
                  <SortTh align="right" active={callSort.col === 'output'} dir={callSort.dir} onClick={function () { handleCallSort('output') }}>Output</SortTh>
                  <SortTh align="right" active={callSort.col === 'cost'} dir={callSort.dir} onClick={function () { handleCallSort('cost') }}>Cost</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {sortedActivity.map(function renderCall(item, i) {
                  return (
                    <tr key={`${item.date}-${item.model}-${i}`}>
                      <td className="px-3 py-2 text-primary-500 tabular-nums">{item.date}</td>
                      <td className="px-3 py-2 text-primary-900">{item.model}</td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {item.requests.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {item.prompt_tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {item.completion_tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums font-medium">
                        {formatCost(item.usage)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptySection message="No activity data for this period" />
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

function SortTh(props: {
  children: React.ReactNode
  align: 'left' | 'right'
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <th
      className={cn(
        'px-3 py-2 font-medium text-primary-700 cursor-pointer select-none hover:text-primary-900 transition-colors',
        props.align === 'right' ? 'text-right' : 'text-left',
      )}
      onClick={props.onClick}
    >
      <span className="inline-flex items-center gap-1">
        {props.align === 'right' && (
          <span className={cn('text-[10px]', props.active ? 'text-primary-700' : 'text-primary-300')}>
            {props.active ? (props.dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        )}
        {props.children}
        {props.align === 'left' && (
          <span className={cn('text-[10px]', props.active ? 'text-primary-700' : 'text-primary-300')}>
            {props.active ? (props.dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        )}
      </span>
    </th>
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
