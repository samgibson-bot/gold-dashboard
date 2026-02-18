import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'
import { updateIdeaStatus } from '../../../server/github'

const VALID_STATUSES = [
  'seed',
  'elaborating',
  'reviewing',
  'validated',
  'building',
  'completed',
  'archived',
]

export const Route = createFileRoute('/api/admin/ideas/status')({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const issueNumber =
            typeof body.issueNumber === 'number' ? body.issueNumber : 0
          const status =
            typeof body.status === 'string' ? body.status.trim() : ''

          if (!issueNumber) {
            return json(
              { ok: false, error: 'issueNumber is required' },
              { status: 400 },
            )
          }

          if (!status || !VALID_STATUSES.includes(status)) {
            return json(
              {
                ok: false,
                error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
              },
              { status: 400 },
            )
          }

          await updateIdeaStatus(issueNumber, status)

          return json({ ok: true })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
