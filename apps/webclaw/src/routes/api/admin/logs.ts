import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/logs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const limit = Number(url.searchParams.get('limit') || '100')
          const level = url.searchParams.get('level') || undefined

          const params: Record<string, unknown> = { limit }
          if (level) params.level = level

          const logs = await gatewayRpc<Record<string, unknown>>(
            'logs.list',
            params,
          )
          return json({ ok: true, logs })
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
