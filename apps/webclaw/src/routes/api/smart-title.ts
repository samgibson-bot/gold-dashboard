import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../server/errors'

const TITLE_SYSTEM_PROMPT = `Generate a concise 3-5 word title for this chat session.
Rules:
- No quotes or punctuation at the end
- Title case
- Be specific about the topic
- Avoid generic titles like "Chat Session" or "Conversation"`

async function getOpenRouterApiKey(): Promise<string | null> {
  try {
    const configPath = `${homedir()}/.openclaw/openclaw.json`
    const raw = await readFile(configPath, 'utf-8')
    const config = JSON.parse(raw) as Record<string, unknown>
    const env = config.env as Record<string, unknown> | undefined
    const key = env?.OPENROUTER_API_KEY
    return typeof key === 'string' && key.trim() ? key.trim() : null
  } catch {
    return null
  }
}

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
            return json({ ok: false, error: 'message required' } satisfies SmartTitleResponse, {
              status: 400,
            })
          }

          const apiKey = await getOpenRouterApiKey()
          if (!apiKey) {
            return json({ ok: false, error: 'no api key' } satisfies SmartTitleResponse, {
              status: 503,
            })
          }

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: TITLE_SYSTEM_PROMPT },
                { role: 'user', content: message },
              ],
              max_tokens: 30,
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(10_000),
          })

          if (!res.ok) {
            return json(
              { ok: false, error: `OpenRouter error: ${res.status}` } satisfies SmartTitleResponse,
              { status: 502 },
            )
          }

          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>
          }
          const raw = data.choices?.[0]?.message?.content ?? ''
          const title = raw
            .trim()
            .replace(/^["'`]|["'`]$/g, '')
            .replace(/[.!?]+$/, '')
            .trim()
            .slice(0, 64)

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
