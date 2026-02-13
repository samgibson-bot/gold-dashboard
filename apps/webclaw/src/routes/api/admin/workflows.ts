import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type { WorkflowRun, FleetRegistry } from '../../../screens/admin/types'

async function getCronPipeline(): Promise<WorkflowRun | null> {
  try {
    const result = await gatewayRpc<{ content?: string }>('fs.readFile', {
      path: 'fleet/registry.json',
    })
    if (!result?.content) return null

    const registry = JSON.parse(result.content) as FleetRegistry
    const scheduledAgents = registry.agents.filter(function hasSchedule(a) {
      return a.cron_schedule !== null
    })

    if (scheduledAgents.length === 0) return null

    return {
      id: 'cron-pipeline',
      name: 'Daily Cron Pipeline',
      type: 'cron_pipeline',
      status: 'pending',
      steps: scheduledAgents.map(function toStep(agent) {
        return {
          agent: agent.id,
          status: 'pending',
        }
      }),
    }
  } catch {
    return null
  }
}

async function getReviewChains(): Promise<Array<WorkflowRun>> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path: '.openclaw/shared-context/agent-outputs' })

    const entries = result?.entries ?? []
    const reviewOutputs = entries.filter(function isReview(e) {
      return e.name.startsWith('review-chain-')
    })

    return reviewOutputs.map(function toWorkflow(e) {
      return {
        id: `rc-${e.name}`,
        name: `Review Chain: ${e.name.replace('review-chain-', '').replace('.md', '')}`,
        type: 'review_chain' as const,
        status: 'completed' as const,
        steps: [
          { agent: 'engineer', status: 'completed' as const },
          { agent: 'critic', status: 'completed' as const },
          { agent: 'architect', status: 'completed' as const },
        ],
        completed: e.modified,
      }
    })
  } catch {
    return []
  }
}

async function getDailySyntheses(): Promise<
  Array<{ date: string; content: string }>
> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path: '.openclaw/shared-context/roundtable' })

    const entries = result?.entries ?? []
    const syntheses: Array<{ date: string; content: string }> = []

    for (const entry of entries.slice(-5)) {
      if (!entry.name.endsWith('.md')) continue
      try {
        const fileResult = await gatewayRpc<{ content?: string }>(
          'fs.readFile',
          { path: `.openclaw/shared-context/roundtable/${entry.name}` },
        )
        syntheses.push({
          date: entry.name.replace('daily-synthesis-', '').replace('.md', ''),
          content: fileResult?.content ?? '',
        })
      } catch {
        // skip
      }
    }

    return syntheses
  } catch {
    return []
  }
}

export const Route = createFileRoute('/api/admin/workflows')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [cronPipeline, reviewChains, syntheses] = await Promise.all([
            getCronPipeline(),
            getReviewChains(),
            getDailySyntheses(),
          ])

          const workflows: Array<WorkflowRun> = []
          if (cronPipeline) workflows.push(cronPipeline)
          workflows.push(...reviewChains)

          return json({ ok: true, workflows, syntheses })
        } catch (err) {
          return json(
            { ok: false, error: sanitizeError(err) },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const action = typeof body.action === 'string' ? body.action : ''

          if (action === 'start_review_chain') {
            const task = typeof body.task === 'string' ? body.task.trim() : ''
            const agents = Array.isArray(body.agents) ? body.agents : ['engineer', 'critic', 'architect']

            if (!task) {
              return json(
                { ok: false, error: 'task is required' },
                { status: 400 },
              )
            }

            // Create a review chain entry in shared-context
            const date = new Date().toISOString().split('T')[0]
            const content = `---
type: review_chain
task: ${task}
agents: [${(agents as Array<string>).join(', ')}]
status: pending
created: ${new Date().toISOString()}
---

# Review Chain: ${task}

## Agents
${(agents as Array<string>).map(function formatAgent(a) { return `- ${a}: pending` }).join('\n')}
`

            await gatewayRpc('fs.writeFile', {
              path: `.openclaw/shared-context/agent-outputs/review-chain-${task}.md`,
              content,
            })

            return json({ ok: true })
          }

          return json(
            { ok: false, error: `Unknown action: ${action}` },
            { status: 400 },
          )
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
