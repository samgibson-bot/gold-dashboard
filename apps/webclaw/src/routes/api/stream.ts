import { createFileRoute } from '@tanstack/react-router'
import { acquireGatewayClient, gatewayRpcShared } from '../../server/gateway'
import { sanitizeError } from '../../server/errors'

type StreamEventPayload = {
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

export const Route = createFileRoute('/api/stream')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const sessionKey = url.searchParams.get('sessionKey')?.trim() || ''
        const friendlyId = url.searchParams.get('friendlyId')?.trim() || ''
        const encoder = new TextEncoder()

        let releaseClient: (() => void) | null = null
        let closed = false

        const stream = new ReadableStream({
          start(controller) {
            function send(data: StreamEventPayload) {
              if (closed) return
              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
                )
              } catch {
                closed = true
              }
            }

            const heartbeat = setInterval(() => {
              controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'))
            }, 15000)

            const key = sessionKey || friendlyId
            if (key) {
              void acquireGatewayClient(key, {
                onEvent(event) {
                  send({
                    event: event.event,
                    payload: event.payload,
                    seq: event.seq,
                    stateVersion: event.stateVersion,
                  })
                },
                onError(error) {
                  send({ event: 'error', payload: sanitizeError(error) })
                },
              })
                .then((handle) => {
                  if (closed) {
                    handle.release()
                    return
                  }
                  releaseClient = handle.release
                  if (sessionKey) {
                    void gatewayRpcShared(
                      'chat.history',
                      { sessionKey, limit: 1 },
                      sessionKey,
                    )
                  }
                })
                .catch((err) => {
                  send({ event: 'error', payload: sanitizeError(err) })
                  closed = true
                  clearInterval(heartbeat)
                  try { controller.close() } catch { /* ignore */ }
                })
            }

            request.signal.addEventListener('abort', () => {
              closed = true
              clearInterval(heartbeat)
              if (releaseClient) {
                releaseClient()
                releaseClient = null
              }
              try { controller.close() } catch { /* ignore */ }
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
