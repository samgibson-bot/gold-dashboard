import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type { ApprovalItem } from '../../../screens/admin/types'

async function listApprovals(): Promise<Array<ApprovalItem>> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path: '.openclaw/shared-context/feedback' })

    const entries = result?.entries ?? []
    const approvals: Array<ApprovalItem> = []

    for (const entry of entries) {
      if (entry.type !== 'file' || !entry.name.endsWith('.md')) continue

      try {
        const fileResult = await gatewayRpc<{ content?: string }>(
          'fs.readFile',
          { path: `.openclaw/shared-context/feedback/${entry.name}` },
        )
        const content = fileResult?.content ?? ''

        // Parse YAML frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
        const fm = fmMatch?.[1] ?? ''
        const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()

        const getField = function getField(key: string): string {
          const match = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
          return match?.[1]?.trim() ?? ''
        }

        approvals.push({
          id: entry.name.replace('.md', ''),
          type: 'decision',
          title: entry.name
            .replace('.md', '')
            .replace(/^\d{4}-\d{2}-\d{2}-/, ''),
          description: body || 'No description',
          agent: getField('agent') || undefined,
          task: getField('task') || undefined,
          status:
            (getField('decision') as 'approved' | 'rejected') || 'pending',
          created: getField('date') || (entry.modified ?? ''),
          reviewer: getField('reviewer') || undefined,
          comment: body || undefined,
        })
      } catch {
        // Skip files that can't be read
      }
    }

    return approvals
  } catch {
    return []
  }
}

export const Route = createFileRoute('/api/admin/approvals')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const approvals = await listApprovals()
          return json({ ok: true, approvals })
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
          const taskSlug = typeof body.task === 'string' ? body.task : ''
          const decision =
            typeof body.decision === 'string' ? body.decision : ''
          const comment = typeof body.comment === 'string' ? body.comment : ''
          const agent = typeof body.agent === 'string' ? body.agent : ''

          if (action !== 'decide') {
            return json({ ok: false, error: 'Unknown action' }, { status: 400 })
          }

          if (!decision || !taskSlug) {
            return json(
              { ok: false, error: 'decision and task are required' },
              { status: 400 },
            )
          }

          const date = new Date().toISOString().split('T')[0]
          const filename = `${date}-${taskSlug}.md`
          const content = `---
date: ${date}
decision: ${decision}
agent: ${agent}
task: ${taskSlug}
reviewer: admin
---
${comment}
`

          await gatewayRpc('fs.writeFile', {
            path: `.openclaw/shared-context/feedback/${filename}`,
            content,
          })

          return json({ ok: true })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
