import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type {
  FleetRegistry,
  WorkflowRun,
  WorkflowStep,
} from '../../../screens/admin/types'

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

const RT_AGENTS = ['scholar', 'engineer', 'muse'] as const

async function getActiveRoundtables(): Promise<Array<WorkflowRun>> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path: '.openclaw/shared-context/roundtable' })

    const entries = result?.entries ?? []
    const rtFiles = entries.filter(function isRtFile(e) {
      return e.type === 'file' && e.name.startsWith('rt-')
    })

    // Group by slug: rt-{slug}-round1-scholar.md → slug
    const slugs = new Map<
      string,
      { files: Set<string>; earliest?: string; latest?: string }
    >()
    for (const f of rtFiles) {
      const match = f.name.match(/^rt-(.+?)-(round[12]-.+|synthesis)\.md$/)
      if (!match) continue
      const slug = match[1]
      if (!slugs.has(slug)) slugs.set(slug, { files: new Set() })
      const group = slugs.get(slug)!
      group.files.add(match[2])
      if (f.modified) {
        if (!group.earliest || f.modified < group.earliest)
          group.earliest = f.modified
        if (!group.latest || f.modified > group.latest)
          group.latest = f.modified
      }
    }

    const workflows: Array<WorkflowRun> = []
    for (const [slug, { files, earliest, latest }] of slugs) {
      const hasSynthesis = files.has('synthesis')

      const steps = [
        ...RT_AGENTS.map(function r1Step(agent) {
          return {
            agent: `${agent} (R1)`,
            status: (files.has(`round1-${agent}`)
              ? 'completed'
              : 'pending') as WorkflowStep['status'],
          }
        }),
        ...RT_AGENTS.map(function r2Step(agent) {
          return {
            agent: `${agent} (R2)`,
            status: (files.has(`round2-${agent}`)
              ? 'completed'
              : 'pending') as WorkflowStep['status'],
          }
        }),
        {
          agent: 'synthesis',
          status: (hasSynthesis
            ? 'completed'
            : 'pending') as WorkflowStep['status'],
        },
      ]

      workflows.push({
        id: `rt-${slug}`,
        name: `Roundtable: ${slug}`,
        type: 'roundtable',
        status: hasSynthesis ? 'completed' : 'running',
        steps,
        started: earliest,
        completed: hasSynthesis ? latest : undefined,
      })
    }

    return workflows
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
          const [cronPipeline, reviewChains, roundtables, syntheses] =
            await Promise.all([
              getCronPipeline(),
              getReviewChains(),
              getActiveRoundtables(),
              getDailySyntheses(),
            ])

          const workflows: Array<WorkflowRun> = []
          if (cronPipeline) workflows.push(cronPipeline)
          workflows.push(...reviewChains)
          workflows.push(...roundtables)

          return json({ ok: true, workflows, syntheses })
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

          if (action === 'start_review_chain') {
            const task = typeof body.task === 'string' ? body.task.trim() : ''
            const agents = Array.isArray(body.agents)
              ? body.agents
              : ['engineer', 'critic', 'architect']

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
${(agents as Array<string>)
  .map(function formatAgent(a) {
    return `- ${a}: pending`
  })
  .join('\n')}
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
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
