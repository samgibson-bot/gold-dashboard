import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

type Session = {
  key: string
  model?: string
  modelProvider?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

type SessionsResponse = {
  sessions?: Array<Session>
  count?: number
}

type OpenRouterModel = {
  id: string
  pricing: {
    prompt: string
    completion: string
  }
}

type OpenRouterModelsResponse = {
  data: Array<OpenRouterModel>
}

// Cache pricing data for 1 hour
let pricingCache: Map<string, { prompt: number; completion: number }> | null =
  null
let pricingCacheTime = 0
const PRICING_CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchOpenRouterPricing(): Promise<
  Map<string, { prompt: number; completion: number }>
> {
  const now = Date.now()
  if (pricingCache && now - pricingCacheTime < PRICING_CACHE_TTL) {
    return pricingCache
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models')
    if (!response.ok) {
      console.warn(
        'Failed to fetch OpenRouter pricing:',
        response.status,
        response.statusText,
      )
      return new Map()
    }
    const data = (await response.json()) as OpenRouterModelsResponse

    const pricing = new Map<string, { prompt: number; completion: number }>()
    for (const model of data.data) {
      const prompt = Number.parseFloat(model.pricing.prompt)
      const completion = Number.parseFloat(model.pricing.completion)
      if (!Number.isNaN(prompt) && !Number.isNaN(completion)) {
        pricing.set(model.id, { prompt, completion })
      }
    }

    pricingCache = pricing
    pricingCacheTime = now
    return pricing
  } catch (err) {
    console.warn('Error fetching OpenRouter pricing:', err)
    return new Map()
  }
}

export const Route = createFileRoute('/api/admin/tokens')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Fetch both sessions and pricing in parallel
          const [sessionsData, pricing] = await Promise.all([
            gatewayRpc<SessionsResponse>('sessions.list', { limit: 500 }),
            fetchOpenRouterPricing(),
          ])

          const sessions = sessionsData.sessions ?? []

          let totalInput = 0
          let totalOutput = 0
          let totalTokens = 0
          let totalCost = 0
          const byModel: Partial<Record<
            string,
            {
              input: number
              output: number
              total: number
              cost: number
              inputCost: number
              outputCost: number
            }
          >> = {}
          const bySession: Array<{
            key: string
            model: string
            input: number
            output: number
            total: number
            cost: number
          }> = []

          for (const s of sessions) {
            const input = s.inputTokens ?? 0
            const output = s.outputTokens ?? 0
            const total = s.totalTokens ?? 0
            const model = s.model ?? s.modelProvider ?? 'unknown'

            // Calculate cost if pricing is available
            const modelPricing = pricing.get(model)
            let sessionCost = 0
            let inputCost = 0
            let outputCost = 0

            if (modelPricing) {
              inputCost = input * modelPricing.prompt
              outputCost = output * modelPricing.completion
              sessionCost = inputCost + outputCost
            }

            totalInput += input
            totalOutput += output
            totalTokens += total
            totalCost += sessionCost

            if (!byModel[model]) {
              byModel[model] = {
                input: 0,
                output: 0,
                total: 0,
                cost: 0,
                inputCost: 0,
                outputCost: 0,
              }
            }
            byModel[model].input += input
            byModel[model].output += output
            byModel[model].total += total
            byModel[model].cost += sessionCost
            byModel[model].inputCost += inputCost
            byModel[model].outputCost += outputCost

            bySession.push({
              key: s.key,
              model,
              input,
              output,
              total,
              cost: sessionCost,
            })
          }

          return json({
            ok: true,
            stats: {
              totalInput,
              totalOutput,
              totalTokens,
              totalCost,
              sessionCount: sessions.length,
              byModel,
              bySession,
            },
          })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
