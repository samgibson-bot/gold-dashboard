import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/missions')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Try 'workspace.ideas.list' first, fall back to unsupported notice
          const missions = await gatewayRpc<Record<string, unknown>>(
            'workspace.ideas.list',
          ).catch(() => null)

          if (missions) {
            return json({ ok: true, missions })
          }

          return json({
            ok: true,
            missions: {
              files: [],
              supported: false,
              message:
                'Workspace ideas listing is not available via gateway RPC in this version.',
            },
          })
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
