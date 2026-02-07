import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/missions')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const missions = await gatewayRpc<Record<string, unknown>>(
            'workspace.ideas.list',
          )
          return json({ ok: true, missions })
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
