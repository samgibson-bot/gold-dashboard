import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

type KeyData = {
  label: string
  limit: number | null
  limit_reset: string | null
  limit_remaining: number | null
  include_byok_in_limit: boolean
  usage: number
  usage_daily: number
  usage_weekly: number
  usage_monthly: number
  byok_usage: number
  byok_usage_daily: number
  byok_usage_weekly: number
  byok_usage_monthly: number
  is_free_tier: boolean
}

type ActivityItem = {
  date: string
  model: string
  model_permaslug: string
  endpoint_id: string
  provider_name: string
  usage: number
  byok_usage_inference: number
  requests: number
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
}

export const Route = createFileRoute('/api/admin/tokens')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const apiKey = process.env.OPENROUTER_API_KEY
          const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY

          const [keyResult, activityResult] = await Promise.all([
            apiKey
              ? fetch(`${OPENROUTER_BASE}/key`, {
                  headers: { Authorization: `Bearer ${apiKey}` },
                })
                  .then(function parseKey(r) {
                    return r.json() as Promise<{ data: KeyData }>
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            managementKey
              ? fetch(`${OPENROUTER_BASE}/activity`, {
                  headers: { Authorization: `Bearer ${managementKey}` },
                })
                  .then(function parseActivity(r) {
                    return r.json() as Promise<{ data: Array<ActivityItem> }>
                  })
                  .catch(() => null)
              : Promise.resolve(null),
          ])

          const balance = keyResult?.data ?? null
          const activityItems: Array<ActivityItem> =
            activityResult?.data ?? []

          // Group by model
          const byModel: Partial<
            Record<
              string,
              {
                usage: number
                requests: number
                prompt_tokens: number
                completion_tokens: number
                reasoning_tokens: number
                provider_name: string
              }
            >
          > = {}
          for (const item of activityItems) {
            const key = item.model
            if (!byModel[key]) {
              byModel[key] = {
                usage: 0,
                requests: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                reasoning_tokens: 0,
                provider_name: item.provider_name,
              }
            }
            byModel[key].usage += item.usage
            byModel[key].requests += item.requests
            byModel[key].prompt_tokens += item.prompt_tokens
            byModel[key].completion_tokens += item.completion_tokens
            byModel[key].reasoning_tokens += item.reasoning_tokens
          }

          // Group by day, sorted ascending
          const dayMap: Partial<Record<string, number>> = {}
          for (const item of activityItems) {
            dayMap[item.date] = (dayMap[item.date] ?? 0) + item.usage
          }
          const costByDay = Object.entries(dayMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(function toPoint([date, value]) {
              return { date, value: value ?? 0 }
            })

          return json({
            ok: true,
            balance,
            activity: activityItems,
            byModel,
            costByDay,
          })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
