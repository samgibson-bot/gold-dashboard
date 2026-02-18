import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type { FleetAgent, FleetRegistry } from '../../../screens/admin/types'

async function readFleetRegistry(): Promise<FleetRegistry | null> {
  try {
    const result = await gatewayRpc<{ content?: string }>('fs.readFile', {
      path: 'fleet/registry.json',
    })
    if (!result?.content) return null
    return JSON.parse(result.content) as FleetRegistry
  } catch {
    return null
  }
}

async function readSoulContent(soulPath: string): Promise<string | null> {
  try {
    const result = await gatewayRpc<{ content?: string }>('fs.readFile', {
      path: soulPath,
    })
    return result?.content ?? null
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/admin/fleet')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [registry, sessionsList] = await Promise.all([
            readFleetRegistry(),
            gatewayRpc<{ sessions?: Array<Record<string, unknown>> }>(
              'sessions.list',
              { limit: 100 },
            ).catch(() => null),
          ])

          if (!registry) {
            return json({
              ok: true,
              registry: {
                agents: [],
                model_routing: {},
                shared_context_path: '~/.openclaw/shared-context',
              },
              active_sessions: [],
            })
          }

          const sessions = Array.isArray(sessionsList?.sessions)
            ? sessionsList.sessions
            : []

          const activeSessionKeys = sessions.map(function getKey(s) {
            return String(s.friendlyId ?? s.key ?? '')
          })

          // Enrich agents with status based on active sessions
          const agents: Array<FleetAgent> = registry.agents.map(
            function enrichAgent(agent) {
              const isActive = activeSessionKeys.some(function matchAgent(key) {
                return key.toLowerCase().includes(agent.id)
              })
              return {
                ...agent,
                status: isActive ? ('active' as const) : ('idle' as const),
              }
            },
          )

          return json({
            ok: true,
            registry: { ...registry, agents },
            active_sessions: activeSessionKeys,
          })
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
          const action = typeof body.action === 'string' ? body.action : ''

          if (action === 'spawn') {
            const agentId =
              typeof body.agent_id === 'string' ? body.agent_id : ''
            if (!agentId) {
              return json(
                { ok: false, error: 'agent_id is required' },
                { status: 400 },
              )
            }

            const registry = await readFleetRegistry()
            if (!registry) {
              return json(
                { ok: false, error: 'Fleet registry not found' },
                { status: 404 },
              )
            }

            const agent = registry.agents.find(function findAgent(a) {
              return a.id === agentId
            })
            if (!agent) {
              return json(
                {
                  ok: false,
                  error: `Agent "${agentId}" not found in registry`,
                },
                { status: 404 },
              )
            }

            const soulContent = await readSoulContent(agent.soul)

            const result = await gatewayRpc<Record<string, unknown>>(
              'sessions.create',
              {
                friendlyId: `fleet-${agentId}`,
                model: agent.model,
                systemPrompt: soulContent ?? `You are the ${agent.id} agent.`,
              },
            )

            return json({ ok: true, session: result })
          }

          if (action === 'read_soul') {
            const soulPath =
              typeof body.soul_path === 'string' ? body.soul_path : ''
            if (!soulPath) {
              return json(
                { ok: false, error: 'soul_path is required' },
                { status: 400 },
              )
            }
            const content = await readSoulContent(soulPath)
            return json({ ok: true, content: content ?? '' })
          }

          return json(
            { ok: false, error: `Unknown action: ${action}` },
            { status: 400 },
          )
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
