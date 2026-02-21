import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../server/gateway'
import { sanitizeError } from '../../server/errors'

type ModelConfig =
  | string
  | { id?: string; model?: string; name?: string; alias?: string }

type GatewayConfigResponse = {
  agents?: {
    defaults?: {
      models?: Array<ModelConfig>
      model?: { primary?: string }
    }
  }
  chat?: {
    models?: Array<ModelConfig>
    defaultModel?: string
  }
  model?: {
    allowed?: Array<ModelConfig>
    defaultModel?: string
  }
}

export type ModelInfo = {
  id: string
  name: string
  provider?: string
}

export type ModelsResponse = {
  ok: boolean
  models: Array<ModelInfo>
  defaultModel: string
}

function parseModelName(id: string): string {
  // Strip common prefixes like "openrouter/"
  const segments = id.split('/')
  // Take the last meaningful segment (e.g., "claude-sonnet-4-5" from "openrouter/anthropic/claude-sonnet-4-5")
  const raw = segments.length > 1 ? segments.slice(1).join('/') : id

  // Remove provider prefix (e.g., "anthropic/")
  const parts = raw.split('/')
  const modelPart = parts[parts.length - 1] ?? raw

  // Convert kebab-case to title case
  return modelPart
    .split('-')
    .map((word) => {
      const upper = word.toUpperCase()
      // Preserve acronyms
      if (['GPT', 'AI', 'API', 'GLM', 'LLM'].includes(upper)) return upper
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function normalizeModel(m: ModelConfig): ModelInfo | null {
  if (typeof m === 'string') {
    return { id: m, name: parseModelName(m) }
  }
  const id = m.id ?? m.model
  if (!id) return null
  const alias = m.alias ? ` (${m.alias})` : ''
  return {
    id,
    name: (m.name ?? parseModelName(id)) + alias,
  }
}

export const Route = createFileRoute('/api/models')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const config = await gatewayRpc<GatewayConfigResponse>(
            'config.get',
            {},
          )

          // Try three config locations in priority order
          const rawModels =
            config.agents?.defaults?.models ??
            config.chat?.models ??
            config.model?.allowed ??
            []

          const models = rawModels
            .map(normalizeModel)
            .filter((m): m is ModelInfo => m !== null)

          if (models.length === 0) {
            return json({
              ok: true,
              models: [{ id: 'default', name: 'Default Model' }],
              defaultModel: 'default',
            } satisfies ModelsResponse)
          }

          const defaultModel =
            config.agents?.defaults?.model?.primary ??
            config.chat?.defaultModel ??
            config.model?.defaultModel ??
            models[0]?.id ??
            'default'

          return json({
            ok: true,
            models,
            defaultModel,
          } satisfies ModelsResponse)
        } catch (err) {
          return json(
            {
              ok: false,
              models: [{ id: 'default', name: 'Default Model' }],
              defaultModel: 'default',
              error: sanitizeError(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
