import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/status')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [nodeStatus, sessionsList] = await Promise.all([
            gatewayRpc<Record<string, unknown>>('nodes.status').catch(
              () => ({}),
            ),
            gatewayRpc<Record<string, unknown>>('sessions.list', {
              limit: 100,
            }).catch(() => ({ sessions: [] })),
          ])

          return json({ ok: true, nodeStatus, sessionsList })
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
