import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/config')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const config = await gatewayRpc<Record<string, unknown>>(
            'config.get',
          )
          return json({ ok: true, config })
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
          const result = await gatewayRpc<Record<string, unknown>>(
            'config.set',
            body,
          )
          return json({ ok: true, result })
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
