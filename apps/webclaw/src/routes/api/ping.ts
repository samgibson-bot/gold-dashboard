import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayConnectCheck } from '../../server/gateway'
import { sanitizeError } from '../../server/errors'

export const Route = createFileRoute('/api/ping')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await gatewayConnectCheck()
          return json({ ok: true })
        } catch (err) {
          return json(
            { ok: false, error: sanitizeError(err) },
            { status: 503 },
          )
        }
      },
    },
  },
})
