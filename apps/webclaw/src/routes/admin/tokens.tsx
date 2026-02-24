import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'

type OpenRouterBalance = {
  label: string
  limit: number | null
  limit_reset: string | null
  limit_remaining: number | null
  usage: number
  usage_daily: number
  usage_weekly: number
  usage_monthly: number
  is_free_tier: boolean
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

type OpenRouterUsageResponse = {
  ok: boolean
  error?: string
  balance: OpenRouterBalance | null
  byModel: Record<string, ModelUsage>
  costByDay: Array<{ date: string; value: number }>
  activity: Array<ActivityItem>
}

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

export const Route = createFileRoute('/admin/tokens')({
  component: TokensPage,
})

function TokensPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.tokens,
    queryFn: async function fetchTokens() {
      const res = await fetch('/api/admin/tokens')
      if (!res.ok) throw new Error('Failed to fetch token usage')
      return (await res.json()) as OpenRouterUsageResponse
    },
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading usage...</div>
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

  if (!data?.ok) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">
          {data?.error ?? 'No usage data available. Add OPENROUTER_API_KEY and OPENROUTER_MANAGEMENT_KEY to your environment.'}
        </div>
      </div>
    )
  }

  const { balance, byModel, costByDay, activity } = data

  const modelEntries = Object.entries(byModel).sort(
    (a, b) => b[1].usage - a[1].usage,
  )

  const pieData = modelEntries
    .filter(([, u]) => u.usage > 0)
    .map(([model, u]) => ({ name: model, value: u.usage }))

  const recentActivity = [...activity]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)

  const budgetValue =
    balance?.limit_remaining != null
      ? `${formatCost(balance.limit_remaining)} left`
      : balance?.limit == null && balance != null
        ? 'Unlimited'
        : null

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">
        Token Usage & Costs
      </h1>

      {/* Balance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatusCard
          label="Today"
          value={balance ? formatCost(balance.usage_daily) : null}
        />
        <StatusCard
          label="This Week"
          value={balance ? formatCost(balance.usage_weekly) : null}
        />
        <StatusCard
          label="This Month"
          value={balance ? formatCost(balance.usage_monthly) : null}
        />
        <StatusCard
          label="All-time"
          value={balance ? formatCost(balance.usage) : null}
        />
        <StatusCard label="Budget" value={budgetValue} />
      </div>

      {/* 30-day cost trend */}
      {costByDay.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            30-day Cost Trend
          </h2>
          <div className="rounded-lg border border-primary-200 bg-surface p-4">
            <SimpleBarChart data={costByDay} />
          </div>
        </div>
      )}

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="border border-primary-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Cost Breakdown by Model
          </h2>
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
      )}

      {/* By model table */}
      {modelEntries.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            By Model
          </h2>
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Model
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Provider
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Requests
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Input
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Output
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {modelEntries.map(function renderModel([model, u]) {
                  return (
                    <tr key={model}>
                      <td className="px-3 py-2 text-primary-900 truncate max-w-[180px]">
                        {model}
                      </td>
                      <td className="px-3 py-2 text-primary-500 truncate max-w-[100px]">
                        {u.provider_name}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {u.requests.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {formatNumber(u.prompt_tokens)}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {formatNumber(u.completion_tokens)}
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
        </div>
      )}

      {/* Daily activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Daily Activity
          </h2>
          <div className="border border-primary-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Model
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-primary-700">
                    Provider
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Requests
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {recentActivity.map(function renderRow(row, i) {
                  return (
                    <tr key={`${row.date}-${row.model}-${i}`}>
                      <td className="px-3 py-2 text-primary-700 tabular-nums">
                        {row.date}
                      </td>
                      <td className="px-3 py-2 text-primary-900 truncate max-w-[180px]">
                        {row.model}
                      </td>
                      <td className="px-3 py-2 text-primary-500 truncate max-w-[100px]">
                        {row.provider_name}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {row.requests.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums font-medium">
                        {formatCost(row.usage)}
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

function SimpleBarChart(props: { data: Array<{ date: string; value: number }> }) {
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
              title={`${point.date}: ${formatCost(point.value)}`}
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
