import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'
import type { UsageStats } from '@/screens/admin/types'

type TokensResponse = {
  ok: boolean
  error?: string
  stats?: UsageStats
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

  const stats = data?.stats ?? {}

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">Token Usage</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          label="Total Cost"
          value={
            typeof stats.totalCost === 'number'
              ? `$${stats.totalCost.toFixed(4)}`
              : '—'
          }
        />
        <StatusCard
          label="Input Tokens"
          value={
            typeof stats.inputTokens === 'number'
              ? stats.inputTokens.toLocaleString()
              : '—'
          }
        />
        <StatusCard
          label="Output Tokens"
          value={
            typeof stats.outputTokens === 'number'
              ? stats.outputTokens.toLocaleString()
              : '—'
          }
        />
        <StatusCard
          label="Total Tokens"
          value={
            typeof stats.totalTokens === 'number'
              ? stats.totalTokens.toLocaleString()
              : '—'
          }
        />
      </div>

      {stats.byModel && stats.byModel.length > 0 ? (
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
                    Tokens
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {stats.byModel.map(function renderModel(entry) {
                  return (
                    <tr key={entry.model}>
                      <td className="px-3 py-2 text-primary-900">
                        {entry.model}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {entry.tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        ${entry.cost.toFixed(4)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {stats.bySession && stats.bySession.length > 0 ? (
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
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Tokens
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-primary-700">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {stats.bySession.map(function renderSession(entry) {
                  return (
                    <tr key={entry.sessionKey}>
                      <td className="px-3 py-2 text-primary-900 truncate max-w-[200px]">
                        {entry.sessionKey}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        {entry.tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-primary-700 tabular-nums">
                        ${entry.cost.toFixed(4)}
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
