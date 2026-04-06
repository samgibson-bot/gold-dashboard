import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'
import { updateIdea } from '../../../server/github'

export const Route = createFileRoute('/api/admin/ideas/update')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const issueNumber =
            typeof body.issueNumber === 'number' ? body.issueNumber : 0
          const title =
            typeof body.title === 'string' ? body.title.trim() : undefined
          const content =
            typeof body.content === 'string' ? body.content : undefined
          const labels = Array.isArray(body.labels)
            ? (body.labels as Array<string>).filter(function isString(t) {
                return typeof t === 'string'
              })
            : undefined

          if (!issueNumber) {
            return json(
              { ok: false, error: 'issueNumber is required' },
              { status: 400 },
            )
          }
          if (title !== undefined && !title) {
            return json(
              { ok: false, error: 'title cannot be empty' },
              { status: 400 },
            )
          }

          const result = await updateIdea({
            issueNumber,
            title,
            body: content,
            labels,
          })

          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
