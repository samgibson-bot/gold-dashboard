import { randomUUID } from 'node:crypto'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import {
  getFleetRepos,
  searchAcrossRepos,
  searchRelatedIssues,
} from '../../../server/github'

const MAX_CONTEXT_LENGTH = 5000
const MAX_SOURCE_LENGTH = 2 * 1024 * 1024 // 2MB for base64 screenshots
const SCREENSHOT_DIR = join(
  homedir(),
  '.openclaw',
  'workspace',
  'idea-screenshots',
)
const SCREENSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

async function saveScreenshot(base64Data: string): Promise<string> {
  await mkdir(SCREENSHOT_DIR, { recursive: true })

  // Strip data URI prefix if present
  const raw = base64Data.replace(/^data:image\/[^;]+;base64,/, '')
  const ext = base64Data.startsWith('data:image/png') ? 'png' : 'jpg'
  const filename = `idea-${randomUUID().slice(0, 8)}.${ext}`
  const filepath = join(SCREENSHOT_DIR, filename)

  await writeFile(filepath, Buffer.from(raw, 'base64'))
  return filepath
}

async function cleanOldScreenshots(): Promise<void> {
  try {
    const files = await readdir(SCREENSHOT_DIR)
    const now = Date.now()
    await Promise.all(
      files.map(async function maybeDelete(f) {
        const fp = join(SCREENSHOT_DIR, f)
        const s = await stat(fp).catch(() => null)
        if (s && now - s.mtimeMs > SCREENSHOT_MAX_AGE_MS) {
          await unlink(fp).catch(() => {})
        }
      }),
    )
  } catch {
    // Directory may not exist yet — that's fine
  }
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

type RelatedIssue = {
  number: number
  title: string
  state: string
  url: string
  snippet: string
}

type CrossRepoMatch = {
  number: number
  title: string
  state: string
  url: string
  repo: string
  snippet: string
}

function buildProjectPrompt(params: {
  context: string
  title?: string
  tags?: Array<string>
  sessionKey: string
}): string {
  const { context, title, tags, sessionKey } = params

  const parts = [
    `## New Project Submission`,
    title ? `**Title:** ${title}` : '',
    tags && tags.length > 0 ? `**Tags:** ${tags.join(', ')}` : '',
    `**Description:**\n${context}`,
    '',
    `## Instructions`,
    '',
    `You have a new personal project submission. This is something the user wants to build with Claude Code — record it cleanly without synergy analysis or lifecycle automation.`,
    '',
    `1. **Understand the vision** — What is being built? Who is it for? What problem does it solve?`,
    '',
    `2. **Create a GitHub Issue** in \`samgibson-bot/gold-ideas\` with labels \`project\` and \`needs-review\`. Do NOT apply \`idea\`, \`seed\`, or any lifecycle labels. ${title ? `The issue title should be the project name exactly as given (clean it up only if there's an obvious typo — don't reformat it).` : `Generate a concise, descriptive title from the description.`}`,
    '',
    `   The issue body should be a concise product brief with these sections:`,
    `   - **Problem / Goal** — What problem does this solve? What's the desired outcome?`,
    `   - **Target User** — Who uses this and in what context?`,
    `   - **Core Features** — 3-5 things it must do at MVP`,
    `   - **Technical Approach** — Language, framework, key infrastructure (2-3 sentences)`,
    `   - **First 3 Steps** — Concrete actions to start building`,
    '',
    `   Keep it tight. This is a backlog item, not a research report.`,
    '',
    `3. **Session tracking** — Include this exact line at the very end of the issue body (it links the dashboard back to this conversation):`,
    '   ```',
    `   <!-- session-key: ${sessionKey} -->`,
    '   ```',
  ]

  return parts.filter(Boolean).join('\n')
}

function buildSeedPrompt(params: {
  sources?: Array<string>
  screenshot?: string
  context: string
  title?: string
  tags?: Array<string>
  relatedIssues?: Array<RelatedIssue>
  crossRepoMatches?: Array<CrossRepoMatch>
  sessionKey: string
}): string {
  const {
    sources,
    screenshot,
    context,
    title,
    tags,
    relatedIssues,
    crossRepoMatches,
    sessionKey,
  } = params

  const urlListText =
    sources && sources.length > 0
      ? sources
          .map(function urlLine(u) {
            return `- ${u}`
          })
          .join('\n')
      : null

  const sourceSection = [
    urlListText ? `**Source URLs:**\n${urlListText}` : null,
    screenshot
      ? `**Screenshot:** saved to \`${screenshot}\` — analyze with the \`image\` tool using this exact path`
      : null,
    !urlListText && !screenshot
      ? `No source provided — analyze the description below`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const analyzeInstruction = [
    urlListText
      ? `Use \`web_fetch\` to crawl and understand each URL listed above.`
      : null,
    screenshot
      ? `Analyze the screenshot at \`${screenshot}\` using the \`image\` tool with this exact file path.`
      : null,
    `Also scan the context/description for any embedded URLs and fetch those too.`,
    !urlListText && !screenshot
      ? `Deeply analyze the description and context provided by the user.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  // Build historical context section from keyword-matched related issues
  const relatedSection =
    relatedIssues && relatedIssues.length > 0
      ? [
          '',
          `## Historical Context (auto-fetched)`,
          '',
          `The following existing gold-ideas issues were found by keyword relevance search. Use these to avoid duplication and identify build-on opportunities:`,
          '',
          ...relatedIssues.map(function formatIssue(i) {
            return `- **#${i.number}** [${i.state}] ${i.title} — ${i.snippet || 'no description'}${i.url ? ` ([link](${i.url}))` : ''}`
          }),
        ]
      : []

  // Build cross-repo section from keyword-matched issues across fleet repos
  const crossRepoSection =
    crossRepoMatches && crossRepoMatches.length > 0
      ? [
          '',
          `## Cross-Repo Context (auto-fetched)`,
          '',
          `Related work found across other repos:`,
          '',
          ...crossRepoMatches.map(function formatMatch(m) {
            return `- **${m.repo}#${m.number}** [${m.state}] ${m.title} — ${m.snippet || 'no description'}${m.url ? ` ([link](${m.url}))` : ''}`
          }),
        ]
      : []

  const parts = [
    `## New Idea Submission`,
    title ? `**Title:** ${title}` : '',
    sourceSection,
    `**Context from submitter:**\n${context}`,
    tags && tags.length > 0 ? `**Tags:** ${tags.join(', ')}` : '',
    ...relatedSection,
    ...crossRepoSection,
    '',
    `## Instructions`,
    '',
    `You have a new idea submission to process. Follow these steps:`,
    '',
    `1. **Analyze all sources** — ${analyzeInstruction} Extract key concepts, technologies, and potential applications from every source.`,
    '',
    `2. **Cross-reference with workspace knowledge** — Run \`memory_search\` for the idea's core topic before proceeding. Review the auto-fetched related issues above (if any). Also check existing \`samgibson-bot/gold-ideas\` Issues for overlaps or synergies. Cross-reference with your workspace files (MEMORY.md, TOOLS.md) for integration points with existing infrastructure. Read \`shared-context/priorities.md\` to understand current priority rankings. Pay special attention to closed/completed issues — the idea may build on prior work.`,
    '',
    `3. **Deep integration analysis** — Generate 5-10 specific integration pathways, each with:`,
    `   - A concrete description of how this idea connects to existing infrastructure (use your workspace knowledge — don't guess)`,
    `   - **Synergies**: how this idea amplifies or is amplified by other pending ideas in \`gold-ideas\` — e.g. "combining this with the Twitter monitoring idea unlocks real-time trend → prototype pipeline"`,
    `   - **Unlocks**: what new capabilities or workflows become possible that weren't before — e.g. "this enables OpenClaw to autonomously discover and prototype integrations without human prompting"`,
    `   - **Insights**: non-obvious connections, second-order effects, or creative applications the submitter might not have considered`,
    `   - Rank each pathway by feasibility (1-5) and potential impact (1-5)`,
    '',
    `4. **Ancestry & Related Issues** — Include a section in the issue body listing which existing issues (open or closed) this idea relates to, with relationship type:`,
    `   - \`builds-on\` — extends or enhances prior work`,
    `   - \`supersedes\` — replaces an older approach`,
    `   - \`alternative-to\` — different approach to the same problem`,
    `   - \`reuses-infrastructure-from\` — leverages technical work from another issue`,
    `   If the auto-fetched historical context above contains relevant matches, reference those. Also search for any others not listed.`,
    '',
    `5. **Create GitHub Issue** in \`samgibson-bot/gold-ideas\` with the full research summary. Use a descriptive title${title ? ` — review the suggested title "${title}" and rewrite it for clarity, standardization, and context if needed. Use a consistent format like "Integration: X" or "Feature: Y" or "Enhancement: Z".` : ' — generate a concise, descriptive, standardized title based on the analysis.'}. Include all source links (if provided), integration pathways, synergy analysis, and the Ancestry section. **Apply these labels:** \`idea\`, \`seed\`, \`needs-review\`, and 1-3 tag labels from this EXACT allowed set — do NOT invent new labels: \`product\`, \`infrastructure\`, \`research\`, \`automation\`, \`agents\`, \`personal\`, \`finance\`, \`health\`, \`social\`, \`business\`. The issue IS the idea — do NOT create any .md files.`,
    '',
    `6. **Session tracking** — Include this exact line at the very end of the issue body (it links the dashboard back to this conversation):`,
    '   ```',
    `   <!-- session-key: ${sessionKey} -->`,
    '   ```',
    '',
    `7. **Thinking Cycle** — After creating the issue, add a focused first comment with your honest assessment: what it would realistically take to build this, the strongest argument against it, how it ranks against current priorities (from shared-context/priorities.md), and any non-obvious connections to other open ideas. Be specific to this idea — a sharp 200-word comment beats a padded template. The comment MUST begin with exactly this sentinel on the first line: <!-- roadmap-posted -->`,
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

          // Accept new multi-source format, with fallback for old single-source format
          const sources: Array<string> = Array.isArray(body.sources)
            ? (body.sources as Array<string>)
                .filter(function isStr(s) {
                  return typeof s === 'string' && s.trim().length > 0
                })
                .map(function trim(s) {
                  return s.trim()
                })
            : typeof body.source === 'string' &&
                body.source.trim() &&
                body.sourceType !== 'screenshot'
              ? [body.source.trim()]
              : []

          const screenshot =
            typeof body.screenshot === 'string' && body.screenshot.trim()
              ? body.screenshot.trim()
              : typeof body.source === 'string' &&
                  body.source.trim() &&
                  body.sourceType === 'screenshot'
                ? body.source.trim()
                : ''

          const type = body.type === 'project' ? 'project' : 'idea'
          const context =
            typeof body.context === 'string' ? body.context.trim() : ''
          const title = typeof body.title === 'string' ? body.title.trim() : ''
          const tags = Array.isArray(body.tags)
            ? (body.tags as Array<string>).filter(function isString(t) {
                return typeof t === 'string'
              })
            : []

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

          for (const url of sources) {
            if (!isValidUrl(url)) {
              return json(
                { ok: false, error: `invalid URL: ${url}` },
                { status: 400 },
              )
            }
          }

          if (screenshot && screenshot.length > MAX_SOURCE_LENGTH) {
            return json(
              { ok: false, error: 'screenshot too large (max 2MB)' },
              { status: 400 },
            )
          }

          // Save screenshot to disk so OpenClaw can access it via file path
          let screenshotPath = ''
          if (screenshot) {
            // Clean old screenshots, then save new one
            await cleanOldScreenshots()
            screenshotPath = await saveScreenshot(screenshot)
          }

          const sessionKey = `ideas:${randomUUID().slice(0, 8)}`
          let message: string

          if (type === 'project') {
            message = buildProjectPrompt({
              context,
              title: title || undefined,
              tags: tags.length > 0 ? tags : undefined,
              sessionKey,
            })
          } else {
            // Build a search query from title + context keywords
            const searchQuery = [title, context.slice(0, 200)]
              .filter(Boolean)
              .join(' ')

            // Fetch fleet repos + related issues + cross-repo matches in parallel
            const fleetRepos = await getFleetRepos()

            const [relatedIssues, crossRepoMatches] = await Promise.all([
              searchRelatedIssues(searchQuery, { maxResults: 15 }).catch(
                function fallback() {
                  return []
                },
              ),
              searchAcrossRepos(searchQuery, fleetRepos, {
                maxResults: 10,
              }).catch(function fallback() {
                return []
              }),
            ])

            const seedPrompt = buildSeedPrompt({
              sources: sources.length > 0 ? sources : undefined,
              screenshot: screenshotPath || undefined,
              context,
              title: title || undefined,
              tags: tags.length > 0 ? tags : undefined,
              relatedIssues:
                relatedIssues.length > 0 ? relatedIssues : undefined,
              crossRepoMatches:
                crossRepoMatches.length > 0 ? crossRepoMatches : undefined,
              sessionKey,
            })

            message = seedPrompt
          }

          const res = await gatewayRpc<{ runId: string }>('chat.send', {
            sessionKey,
            message,
            deliver: false,
            timeoutMs: 120_000,
            idempotencyKey: randomUUID(),
          })

          return json({ ok: true, sessionKey, ...res })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
