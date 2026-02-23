import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type { WebhookConfig } from '../../../screens/admin/types'

const WEBHOOKS_PATH = '.openclaw/shared-context/webhooks.json'

async function readWebhooks(): Promise<Array<WebhookConfig>> {
  try {
    const result = await gatewayRpc<{ content?: string }>('fs.readFile', {
      path: WEBHOOKS_PATH,
    })
    if (!result.content) return []
    const data = JSON.parse(result.content)
    return Array.isArray(data.webhooks) ? data.webhooks : []
  } catch {
    return []
  }
}

async function writeWebhooks(webhooks: Array<WebhookConfig>): Promise<void> {
  await gatewayRpc('fs.writeFile', {
    path: WEBHOOKS_PATH,
    content: JSON.stringify({ webhooks }, null, 2),
  })
}

export const Route = createFileRoute('/api/admin/webhooks')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const webhooks = await readWebhooks()
          return json({ ok: true, webhooks })
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

          if (action === 'create') {
            const name = typeof body.name === 'string' ? body.name.trim() : ''
            const source =
              typeof body.source === 'string' ? body.source.trim() : ''

            if (!name) {
              return json(
                { ok: false, error: 'name is required' },
                { status: 400 },
              )
            }

            const webhooks = await readWebhooks()
            const id = randomUUID().slice(0, 8)
            const newWebhook: WebhookConfig = {
              id,
              name,
              url: `/api/admin/webhooks/receive/${id}`,
              source: source || 'custom',
              created: new Date().toISOString(),
              event_count: 0,
              active: true,
            }

            webhooks.push(newWebhook)
            await writeWebhooks(webhooks)

            return json({ ok: true, webhook: newWebhook })
          }

          if (action === 'delete') {
            const id = typeof body.id === 'string' ? body.id : ''
            if (!id) {
              return json(
                { ok: false, error: 'id is required' },
                { status: 400 },
              )
            }

            const webhooks = await readWebhooks()
            const filtered = webhooks.filter(function keep(w) {
              return w.id !== id
            })
            await writeWebhooks(filtered)

            return json({ ok: true })
          }

          if (action === 'toggle') {
            const id = typeof body.id === 'string' ? body.id : ''
            if (!id) {
              return json(
                { ok: false, error: 'id is required' },
                { status: 400 },
              )
            }

            const webhooks = await readWebhooks()
            const webhook = webhooks.find(function find(w) {
              return w.id === id
            })
            if (webhook) {
              webhook.active = !webhook.active
              await writeWebhooks(webhooks)
            }

            return json({ ok: true })
          }

          return json(
            { ok: false, error: `Unknown action: ${action}` },
            { status: 400 },
          )
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
