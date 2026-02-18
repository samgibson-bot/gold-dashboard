import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'

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
  bySession: Array<{
    key: string
    model: string
    input: number
    output: number
    total: number
    cost: number
  }>
}

type TokensResponse = {
  ok: boolean
  error?: string
  stats?: TokenStats
}

const CHART_COLORS = [
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#ea580c', // orange-600
  '#16a34a', // green-600
  '#0891b2', // cyan-600
  '#4f46e5', // indigo-600
  '#9333ea', // purple-600
]

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(6)}`
  return `$${cost.toFixed(4)}`
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
      return (await res.json()) as TokensResponse
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

  const stats = data?.stats

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">No usage data available.</div>
      </div>
    )
  }

  const modelEntries = Object.entries(stats.byModel).sort(
    (a, b) => b[1].cost - a[1].cost,
  )

  // Prepare pie chart data
  const pieData = modelEntries
    .filter(([, usage]) => usage.cost > 0)
    .map(([model, usage]) => ({
      name: model,
      value: usage.cost,
    }))

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">
        Token Usage & Costs
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatusCard label="Total Cost" value={formatCost(stats.totalCost)} />
        <StatusCard
          label="Total Tokens"
          value={stats.totalTokens.toLocaleString()}
        />
        <StatusCard
          label="Input Tokens"
          value={stats.totalInput.toLocaleString()}
        />
        <StatusCard
          label="Output Tokens"
          value={stats.totalOutput.toLocaleString()}
        />
        <StatusCard label="Sessions" value={String(stats.sessionCount)} />
      </div>

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

      {modelEntries.length > 0 ? (
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
        </div>
      ) : null}

      {stats.bySession.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            By Session
          </h2>
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
        </div>
      ) : null}
    </div>
  )
}
