import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/metrics')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const range = url.searchParams.get('range') ?? '7d'

          // Get token usage from gateway
          const [tokensResult, kpisResult] = await Promise.all([
            gatewayRpc<Record<string, unknown>>('tokens.usage', {
              range,
            }).catch(() => null),
            gatewayRpc<{ content?: string }>('fs.readFile', {
              path: '.openclaw/shared-context/kpis/current.json',
            }).catch(() => null),
          ])

          let kpis = null
          if (kpisResult?.content) {
            try {
              kpis = JSON.parse(kpisResult.content)
            } catch {
              // ignore parse errors
            }
          }

          // Build token cost history from usage data
          const tokenHistory = Array.isArray(
            (tokensResult as Record<string, unknown>)?.history,
          )
            ? (
                (tokensResult as Record<string, unknown>)
                  .history as Array<Record<string, unknown>>
              ).map(function mapPoint(h) {
                return {
                  date: String(h.date ?? ''),
                  value: Number(h.cost ?? h.tokens ?? 0),
                }
              })
            : []

          // Build fleet utilization from KPIs
          const fleetUtilization = kpis?.fleet
            ? [
                {
                  agent: 'total',
                  hours: Number(kpis.fleet.active_agents ?? 0),
                },
              ]
            : []

          return json({
            ok: true,
            metrics: {
              throughput: [],
              cycle_time: [],
              token_costs: tokenHistory,
              fleet_utilization: fleetUtilization,
            },
            kpis,
            tokens: tokensResult,
          })
        } catch (err) {
          return json(
            { ok: false, error: sanitizeError(err) },
            { status: 500 },
          )
        }
      },
    },
  },
})
