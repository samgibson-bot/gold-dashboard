import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getOpenRouterApiKey,
  openRouterComplete,
} from '../../server/openrouter'
import { sanitizeError } from '../../server/errors'

const TITLE_SYSTEM_PROMPT = `Generate a concise 3-5 word title for this chat session.
Rules:
- No quotes or punctuation at the end
- Title case
- Be specific about the topic
- Avoid generic titles like "Chat Session" or "Conversation"`

type SmartTitleResponse = {
  ok: boolean
  title?: string
  error?: string
}

export const Route = createFileRoute('/api/smart-title')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const message =
            typeof body.message === 'string' ? body.message.slice(0, 500) : ''
          if (!message.trim()) {
            return json(
              { ok: false, error: 'message required' } satisfies SmartTitleResponse,
              { status: 400 },
            )
          }

          const apiKey = await getOpenRouterApiKey()
          if (!apiKey) {
            return json(
              { ok: false, error: 'no api key' } satisfies SmartTitleResponse,
              { status: 503 },
            )
          }

          const raw = await openRouterComplete(apiKey, {
            messages: [
              { role: 'system', content: TITLE_SYSTEM_PROMPT },
              { role: 'user', content: message },
            ],
            maxTokens: 30,
            temperature: 0.3,
          })

          const title = raw
            ? raw
                .replace(/^["'`]|["'`]$/g, '')
                .replace(/[.!?]+$/, '')
                .trim()
                .slice(0, 64)
            : ''

          if (!title) {
            return json({ ok: false, error: 'empty response' } satisfies SmartTitleResponse)
          }

          return json({ ok: true, title } satisfies SmartTitleResponse)
        } catch (err) {
          return json(
            { ok: false, error: sanitizeError(err) } satisfies SmartTitleResponse,
            { status: 500 },
          )
        }
      },
    },
  },
})
