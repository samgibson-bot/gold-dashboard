import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

const MAX_CONTEXT_LENGTH = 5000
const MAX_SOURCE_LENGTH = 2 * 1024 * 1024 // 2MB for base64 screenshots

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function buildSeedPrompt(params: {
  source?: string
  sourceType?: 'url' | 'screenshot'
  context: string
  title?: string
  tags?: Array<string>
}): string {
  const { source, sourceType, context, title, tags } = params

  const sourceDesc = source
    ? sourceType === 'url'
      ? `Source URL: ${source}`
      : 'Source: screenshot attached (analyze with vision)'
    : 'No source provided — analyze the description below'

  const parts = [
    `## New Idea Submission`,
    title ? `**Title:** ${title}` : '',
    sourceDesc,
    `**Context from submitter:**\n${context}`,
    tags && tags.length > 0 ? `**Tags:** ${tags.join(', ')}` : '',
    '',
    `## Instructions`,
    '',
    `You have a new idea submission to process. Follow these steps:`,
    '',
    `1. **Analyze the source** — ${source ? (sourceType === 'url' ? 'Use \`web_fetch\` to crawl and understand the source URL.' : 'Analyze the attached screenshot using vision.') : 'Deeply analyze the description and context provided by the user.'} Extract key concepts, technologies, and potential applications.`,
    '',
    `2. **Cross-reference** — Check existing \`samgibson-bot/gold-ideas\` Issues for overlaps or synergies. Scan OpenClaw docs for integration points with existing infrastructure.`,
    '',
    `3. **Deep integration analysis** — Generate 5-10 specific integration pathways, each with:`,
    `   - A concrete description of how this idea connects to OpenClaw's existing infrastructure (cron jobs, browser agent, specialist agents, tools, nodes, sessions, skills)`,
    `   - **Synergies**: how this idea amplifies or is amplified by other pending ideas in \`gold-ideas\` — e.g. "combining this with the Twitter monitoring idea unlocks real-time trend → prototype pipeline"`,
    `   - **Unlocks**: what new capabilities or workflows become possible that weren't before — e.g. "this enables OpenClaw to autonomously discover and prototype integrations without human prompting"`,
    `   - **Insights**: non-obvious connections, second-order effects, or creative applications the submitter might not have considered`,
    `   - Rank each pathway by feasibility (1-5) and potential impact (1-5)`,
    '',
    `4. **Create GitHub Issue** in \`samgibson-bot/gold-ideas\` with the full research summary. Use a descriptive title${title ? `Review the suggested title \"${title}\" and rewrite it for clarity, standardization, and context if needed. Use a consistent format like \"Integration: X\" or \"Feature: Y\" or \"Enhancement: Z\".` : 'Generate a concise, descriptive, standardized title based on the analysis.'}. Include source link (if provided), integration pathways, and synergy analysis.`,
    '',
    `5. **Create idea file** on main branch (\`ideas/<slug>.md\`) with YAML frontmatter including \`status: seed\`, title, created date, tags, and issue number. Body should contain the source and a summary.`,
    '',
    `6. **Thinking Cycle** — After creating the issue, add an expansive 10-point roadmap as the first comment covering: problem definition, architecture sketch, dependencies, MVP scope, data model, integration points, testing strategy, deployment plan, risks/mitigations, and future extensions.`,
  ]

  return parts.filter(Boolean).join('\n')
}

export const Route = createFileRoute('/api/admin/ideas/submit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const source =
            typeof body.source === 'string' ? body.source.trim() : ''
          const sourceType =
            body.sourceType === 'screenshot' ? 'screenshot' : 'url'
          const context =
            typeof body.context === 'string' ? body.context.trim() : ''
          const title =
            typeof body.title === 'string' ? body.title.trim() : ''
          const tags = Array.isArray(body.tags)
            ? (body.tags as Array<string>).filter(
                function isString(t) {
                  return typeof t === 'string'
                },
              )
            : []

          // Source is now optional - AI can work with just description

          if (!context) {
            return json(
              { ok: false, error: 'context is required' },
              { status: 400 },
            )
          }

          if (context.length > MAX_CONTEXT_LENGTH) {
            return json(
              { ok: false, error: 'context too long (max 5000 chars)' },
              { status: 400 },
            )
          }

          if (source && sourceType === 'url' && !isValidUrl(source)) {
            return json(
              { ok: false, error: 'invalid URL' },
              { status: 400 },
            )
          }

          if (source && sourceType === 'screenshot' && source.length > MAX_SOURCE_LENGTH) {
            return json(
              { ok: false, error: 'screenshot too large (max 2MB)' },
              { status: 400 },
            )
          }

          const seedPrompt = buildSeedPrompt({
            source,
            sourceType,
            context,
            title: title || undefined,
            tags: tags.length > 0 ? tags : undefined,
          })

          const message =
            source && sourceType === 'screenshot'
              ? `${seedPrompt}\n\n[Screenshot data attached as base64]\n${source}`
              : seedPrompt

          const res = await gatewayRpc<{ runId: string }>('chat.send', {
            sessionKey: 'ideas',
            message,
            deliver: false,
            timeoutMs: 120_000,
            idempotencyKey: randomUUID(),
          })

          return json({ ok: true, sessionKey: 'ideas', ...res })
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
