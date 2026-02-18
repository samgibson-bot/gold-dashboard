import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/cron')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const cron = await gatewayRpc<Record<string, unknown>>('cron.list')
          return json({ ok: true, cron })
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
          const result = await gatewayRpc<Record<string, unknown>>(
            'cron.create',
            body,
          )
          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const result = await gatewayRpc<Record<string, unknown>>(
            'cron.update',
            body,
          )
          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
      DELETE: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) {
            return json({ ok: false, error: 'id required' }, { status: 400 })
          }
          await gatewayRpc('cron.delete', { id })
          return json({ ok: true })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
