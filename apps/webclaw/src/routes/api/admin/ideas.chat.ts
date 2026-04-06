import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

const MAX_MESSAGE_LENGTH = 5000

export const Route = createFileRoute('/api/admin/ideas/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const message =
            typeof body.message === 'string' ? body.message.trim() : ''
          const ideaTitle =
            typeof body.ideaTitle === 'string' ? body.ideaTitle.trim() : ''
          const ideaNumber =
            typeof body.ideaNumber === 'number' ? body.ideaNumber : 0
          const sessionKey =
            typeof body.sessionKey === 'string'
              ? body.sessionKey.trim()
              : undefined

          if (!message) {
            return json(
              { ok: false, error: 'message is required' },
              { status: 400 },
            )
          }

          if (message.length > MAX_MESSAGE_LENGTH) {
            return json(
              { ok: false, error: 'message too long (max 5000 chars)' },
              { status: 400 },
            )
          }

          // Use the idea's own session if available, otherwise create a new one
          const targetSession =
            sessionKey || `ideas:${randomUUID().slice(0, 8)}`
          const contextualMessage = `Re: "${ideaTitle}"${ideaNumber ? ` (issue #${ideaNumber})` : ''}\n\n${message}`

          const res = await gatewayRpc<{ runId: string }>('chat.send', {
            sessionKey: targetSession,
            message: contextualMessage,
            deliver: false,
            timeoutMs: 120_000,
            idempotencyKey: randomUUID(),
          })

          return json({ ok: true, sessionKey: targetSession, ...res })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
