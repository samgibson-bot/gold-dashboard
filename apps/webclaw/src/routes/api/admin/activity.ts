import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type { ActivityEvent } from '../../../screens/admin/types'

async function getGatewaySessions(): Promise<Array<ActivityEvent>> {
  try {
    const result = await gatewayRpc<{
      sessions?: Array<Record<string, unknown>>
    }>('sessions.list', { limit: 20 })

    const sessions = result?.sessions ?? []
    return sessions.map(function toEvent(s, i) {
      return {
        id: `gw-${String(s.key ?? i)}`,
        type: 'gateway' as const,
        agent: String(s.friendlyId ?? s.key ?? 'unknown'),
        action: 'session_active',
        summary: `Session ${String(s.friendlyId ?? s.key ?? '')} — ${String(s.status ?? 'unknown')} (${String(s.messageCount ?? s.messages ?? 0)} messages)`,
        timestamp: String(s.lastActivity ?? new Date().toISOString()),
      }
    })
  } catch {
    return []
  }
}

async function getAgentOutputs(): Promise<Array<ActivityEvent>> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path: '.openclaw/shared-context/agent-outputs' })

    const entries = result?.entries ?? []
    return entries
      .filter(function isFile(e) {
        return e.type === 'file' && e.name.endsWith('.md')
      })
      .map(function toEvent(e) {
        const parts = e.name.replace('.md', '').split('-')
        const agent = parts[0] ?? 'unknown'
        return {
          id: `ao-${e.name}`,
          type: 'agent' as const,
          agent,
          action: 'output_written',
          summary: `Agent ${agent} wrote output: ${e.name}`,
          timestamp: e.modified ?? new Date().toISOString(),
        }
      })
  } catch {
    return []
  }
}

async function getFeedbackEvents(): Promise<Array<ActivityEvent>> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path: '.openclaw/shared-context/feedback' })

    const entries = result?.entries ?? []
    return entries
      .filter(function isFile(e) {
        return e.type === 'file' && e.name.endsWith('.md')
      })
      .map(function toEvent(e) {
        return {
          id: `fb-${e.name}`,
          type: 'feedback' as const,
          action: 'decision_recorded',
          summary: `Feedback: ${e.name.replace('.md', '')}`,
          timestamp: e.modified ?? new Date().toISOString(),
        }
      })
  } catch {
    return []
  }
}

export const Route = createFileRoute('/api/admin/activity')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const typeFilter = url.searchParams.get('type')

          const [gatewaySessions, agentOutputs, feedbackEvents] =
            await Promise.all([
              getGatewaySessions(),
              getAgentOutputs(),
              getFeedbackEvents(),
            ])

          let events: Array<ActivityEvent> = [
            ...gatewaySessions,
            ...agentOutputs,
            ...feedbackEvents,
          ]

          // Sort by timestamp descending
          events.sort(function sortByTime(a, b) {
            return (
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime()
            )
          })

          // Filter by type if specified
          if (typeFilter) {
            events = events.filter(function matchType(e) {
              return e.type === typeFilter
            })
          }

          return json({ ok: true, events })
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
