import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import {
  getOpenRouterApiKey,
  openRouterComplete,
} from '../../../server/openrouter'

const DESCRIBE_SYSTEM_PROMPT = `Generate a single sentence describing what this scheduled agent task does.
Rules:
- One sentence, ending with a period
- Plain English, no technical jargon
- Start with an action verb (e.g. "Compresses...", "Backs up...", "Analyzes...")
- Be specific but concise (under 20 words)
- No quotes`

export const Route = createFileRoute('/api/admin/cron')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const cron = await gatewayRpc<Record<string, unknown>>('cron.list')
          return json({ ok: true, cron })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          if (body.action === 'describe') {
            const payload =
              typeof body.payload === 'string' ? body.payload.slice(0, 1000) : ''
            if (!payload.trim()) {
              return json(
                { ok: false, error: 'payload required' },
                { status: 400 },
              )
            }
            const apiKey = await getOpenRouterApiKey()
            if (!apiKey) {
              return json(
                { ok: false, error: 'no api key' },
                { status: 503 },
              )
            }
            const raw = await openRouterComplete(apiKey, {
              model: 'google/gemini-2.0-flash-lite',
              messages: [
                { role: 'system', content: DESCRIBE_SYSTEM_PROMPT },
                { role: 'user', content: payload },
              ],
              maxTokens: 60,
              temperature: 0.3,
            })
            const description = raw
              ? raw
                  .replace(/^["'`]|["'`]$/g, '')
                  .replace(/\.?\s*$/, '.')
                  .trim()
                  .slice(0, 200)
              : ''
            if (!description) {
              return json({ ok: false, error: 'empty response' })
            }
            return json({ ok: true, description })
          }

          if (body.action === 'runs') {
            const id = typeof body.id === 'string' ? body.id : ''
            if (!id) {
              return json({ ok: false, error: 'id required' }, { status: 400 })
            }
            const result = await gatewayRpc<{ runs?: Array<unknown> }>(
              'cron.runs',
              { id },
            )
            return json({ ok: true, runs: result.runs ?? [] })
          }
          const result = await gatewayRpc<Record<string, unknown>>(
            'cron.add',
            body,
          )
          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const jobId = typeof body.id === 'string' ? body.id : ''
          if (!jobId) {
            return json(
              { ok: false, error: 'id required' },
              { status: 400 },
            )
          }
          const { id: _id, ...patch } = body
          const result = await gatewayRpc<Record<string, unknown>>(
            'cron.update',
            { jobId, patch },
          )
          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
      DELETE: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) {
            return json({ ok: false, error: 'id required' }, { status: 400 })
          }
          await gatewayRpc('cron.delete', { id })
          return json({ ok: true })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
