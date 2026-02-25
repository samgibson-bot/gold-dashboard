import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'

export const OPENROUTER_MODEL = 'google/gemini-3-flash-preview'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export async function getOpenRouterApiKey(): Promise<string | null> {
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

type OpenRouterMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type OpenRouterOptions = {
  messages: Array<OpenRouterMessage>
  maxTokens: number
  temperature?: number
  timeoutMs?: number
  model?: string
}

/**
 * Call OpenRouter with the shared cheap model.
 * Returns the response text, or null on any error.
 */
export async function openRouterComplete(
  apiKey: string,
  opts: OpenRouterOptions,
): Promise<string | null> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? OPENROUTER_MODEL,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.5,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
  })

  if (!res.ok) return null

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  return text.trim() || null
}
