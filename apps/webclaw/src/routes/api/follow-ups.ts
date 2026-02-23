import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getOpenRouterApiKey,
  openRouterComplete,
} from '../../server/openrouter'
import { sanitizeError } from '../../server/errors'

const FOLLOW_UP_SYSTEM_PROMPT = `You are a helpful assistant that generates follow-up question suggestions.
Given the assistant's last response, generate exactly 3 short, natural follow-up questions the user might want to ask.
Rules:
- Each question should be concise (under 60 characters)
- One question per line
- No numbering, bullets, or quotes
- Questions should be diverse (clarifying, expanding, practical)
- Do not repeat the original question`

function parseFollowUps(text: string): Array<string> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d+[.)]\s*/, ''))
    .map((line) => line.replace(/^[-•*]\s*/, ''))
    .map((line) => line.replace(/^["']|["']$/g, ''))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 150)
    .slice(0, 3)
}

type FollowUpsResponse = {
  ok: boolean
  suggestions: Array<string>
  error?: string
}

export const Route = createFileRoute('/api/follow-ups')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const responseText =
            typeof body.responseText === 'string' ? body.responseText : ''
          const contextSummary =
            typeof body.contextSummary === 'string' ? body.contextSummary : ''

          if (responseText.length < 30) {
            return json({
              ok: true,
              suggestions: [],
            } satisfies FollowUpsResponse)
          }

          const apiKey = await getOpenRouterApiKey()
          if (!apiKey) {
            return json({ ok: true, suggestions: [] } satisfies FollowUpsResponse)
          }

          const truncatedResponse = responseText.slice(0, 1500)
          const truncatedContext = contextSummary.slice(0, 500)

          const userContent = truncatedContext
            ? `Context: ${truncatedContext}\n\nAssistant's response:\n${truncatedResponse}`
            : `Assistant's response:\n${truncatedResponse}`

          const text = await openRouterComplete(apiKey, {
            messages: [
              { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            maxTokens: 200,
            temperature: 0.7,
          })

          const suggestions = text ? parseFollowUps(text) : []

          return json({
            ok: true,
            suggestions,
          } satisfies FollowUpsResponse)
        } catch (err) {
          return json(
            {
              ok: false,
              suggestions: [],
              error: sanitizeError(err),
            } satisfies FollowUpsResponse,
            { status: 500 },
          )
        }
      },
    },
  },
})
