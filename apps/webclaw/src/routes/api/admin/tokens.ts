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
  sessions?: Session[]
  count?: number
}

export const Route = createFileRoute('/api/admin/tokens')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // gateway.usage.stats doesn't exist - derive from sessions.list
          const sessionsData = await gatewayRpc<SessionsResponse>(
            'sessions.list',
            { limit: 500 },
          )

          const sessions = sessionsData?.sessions ?? []

          let totalInput = 0
          let totalOutput = 0
          let totalTokens = 0
          const byModel: Record<
            string,
            { input: number; output: number; total: number }
          > = {}
          const bySession: {
            key: string
            model: string
            input: number
            output: number
            total: number
          }[] = []

          for (const s of sessions) {
            const input = s.inputTokens ?? 0
            const output = s.outputTokens ?? 0
            const total = s.totalTokens ?? 0
            const model = s.model ?? s.modelProvider ?? 'unknown'

            totalInput += input
            totalOutput += output
            totalTokens += total

            if (!byModel[model]) byModel[model] = { input: 0, output: 0, total: 0 }
            byModel[model].input += input
            byModel[model].output += output
            byModel[model].total += total

            bySession.push({ key: s.key, model, input, output, total })
          }

          return json({
            ok: true,
            stats: {
              totalInput,
              totalOutput,
              totalTokens,
              sessionCount: sessions.length,
              byModel,
              bySession,
            },
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
