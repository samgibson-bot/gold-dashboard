import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'
import { createIdea, listIdeas } from '../../../server/github'
import type { CreateIdeaInput } from '../../../server/github'

export const Route = createFileRoute('/api/admin/ideas')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const ideas = await listIdeas()

          return json({
            ok: true,
            ideas,
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

          const title = typeof body.title === 'string' ? body.title.trim() : ''
          const description =
            typeof body.description === 'string' ? body.description.trim() : ''
          const tags = Array.isArray(body.tags)
            ? (body.tags as Array<string>).filter(function isString(t) {
                return typeof t === 'string'
              })
            : []

          if (!title) {
            return json(
              { ok: false, error: 'Title is required' },
              { status: 400 },
            )
          }
          if (!description) {
            return json(
              { ok: false, error: 'Description is required' },
              { status: 400 },
            )
          }

          const input: CreateIdeaInput = { title, description, tags }
          const result = await createIdea(input)

          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
