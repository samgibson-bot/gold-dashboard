import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

export const Route = createFileRoute('/api/admin/browser')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Try 'browser.status' first, fall back to unsupported notice
          const status = await gatewayRpc<Record<string, unknown>>(
            'browser.status',
          ).catch(() => null)

          if (status) {
            return json({ ok: true, status })
          }

          return json({
            ok: true,
            status: {
              running: false,
              supported: false,
              message:
                'Browser status is not available via gateway RPC in this version.',
            },
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
          const action = typeof body.action === 'string' ? body.action : ''

          let result: Record<string, unknown> = {}

          switch (action) {
            case 'launch':
              result =
                await gatewayRpc<Record<string, unknown>>('browser.launch')
              break
            case 'stop':
              result = await gatewayRpc<Record<string, unknown>>('browser.stop')
              break
            case 'navigate':
              result = await gatewayRpc<Record<string, unknown>>(
                'browser.navigate',
                {
                  pageId: body.pageId,
                  url: body.url,
                },
              )
              break
            case 'close':
              result = await gatewayRpc<Record<string, unknown>>(
                'browser.close',
                { pageId: body.pageId },
              )
              break
            default:
              return json(
                { ok: false, error: 'unknown action' },
                { status: 400 },
              )
          }

          return json({ ok: true, result })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
