import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/tokens')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const stats = await gatewayRpc<Record<string, unknown>>(
            'gateway.usage.stats',
          )
          return json({ ok: true, stats })
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
