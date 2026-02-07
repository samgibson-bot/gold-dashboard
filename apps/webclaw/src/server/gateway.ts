import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

type GatewayFrame =
  | { type: 'req'; id: string; method: string; params?: unknown }
  | {
      type: 'res'
      id: string
      ok: boolean
      payload?: unknown
      error?: { code: string; message: string; details?: unknown }
    }
  | { type: 'event'; event: string; payload?: unknown; seq?: number }

type ConnectParams = {
  minProtocol: number
  maxProtocol: number
  client: {
    id: string
    displayName?: string
    version: string
    platform: string
    mode: string
    instanceId?: string
  }
  auth?: { token?: string; password?: string }
  role?: 'operator' | 'node'
  scopes?: Array<string>
}

type GatewayWaiter = {
  waitForRes: (id: string, timeoutMs?: number) => Promise<unknown>
  handleMessage: (evt: MessageEvent) => void
  cleanup: () => void
}

const DEFAULT_TIMEOUT_MS = 30_000

let cachedWs: WebSocket | null = null
let cachedWaiter: GatewayWaiter | null = null
let cachedConnected = false
let connectionPromise: Promise<void> | null = null

function getGatewayConfig() {
  const url = process.env.CLAWDBOT_GATEWAY_URL?.trim() || 'ws://127.0.0.1:18789'
  const token = process.env.CLAWDBOT_GATEWAY_TOKEN?.trim() || ''
  const password = process.env.CLAWDBOT_GATEWAY_PASSWORD?.trim() || ''

  if (!token && !password) {
    throw new Error(
      'Missing gateway auth. Set CLAWDBOT_GATEWAY_TOKEN (recommended) or CLAWDBOT_GATEWAY_PASSWORD in the server environment.',
    )
  }

  return { url, token, password }
}

function getGatewayScopes(): Array<string> {
  const envScopes = process.env.CLAWDBOT_GATEWAY_SCOPES?.trim()
  if (envScopes) {
    return envScopes.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return ['operator.admin']
}

function buildConnectParams(token: string, password: string): ConnectParams {
  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'gateway-client',
      displayName: 'gold-dashboard',
      version: 'dev',
      platform: process.platform,
      mode: 'ui',
      instanceId: randomUUID(),
    },
    auth: {
      token: token || undefined,
      password: password || undefined,
    },
    role: 'operator',
    scopes: getGatewayScopes(),
  }
}

function createGatewayWaiter(): GatewayWaiter {
  const waiters = new Map<
    string,
    {
      resolve: (v: unknown) => void
      reject: (e: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()

  function waitForRes(id: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(id)
        reject(new Error(`Gateway request timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      waiters.set(id, { resolve, reject, timer })
    })
  }

  function handleMessage(evt: MessageEvent) {
    try {
      const data = typeof evt.data === 'string' ? evt.data : ''
      const parsed = JSON.parse(data) as GatewayFrame
      if (parsed.type !== 'res') return
      const w = waiters.get(parsed.id)
      if (!w) return
      clearTimeout(w.timer)
      waiters.delete(parsed.id)
      if (parsed.ok) w.resolve(parsed.payload)
      else w.reject(new Error(parsed.error?.message ?? 'gateway error'))
    } catch {
      // ignore parse errors
    }
  }

  function cleanup() {
    for (const [id, w] of waiters) {
      clearTimeout(w.timer)
      w.reject(new Error('Gateway connection closed'))
    }
    waiters.clear()
  }

  return { waitForRes, handleMessage, cleanup }
}

async function wsOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === ws.OPEN) return
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (e: Event) => {
      cleanup()
      reject(new Error(`WebSocket error: ${String((e as any)?.message ?? e)}`))
    }
    const cleanup = () => {
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('error', onError)
    }
    ws.addEventListener('open', onOpen)
    ws.addEventListener('error', onError)
  })
}

function resetCachedConnection() {
  if (cachedWaiter) {
    cachedWaiter.cleanup()
    cachedWaiter = null
  }
  if (cachedWs) {
    try { cachedWs.close() } catch { /* ignore */ }
    cachedWs = null
  }
  cachedConnected = false
  connectionPromise = null
}

async function getConnection(): Promise<{ ws: WebSocket; waiter: GatewayWaiter }> {
  if (cachedWs && cachedWs.readyState === WebSocket.OPEN && cachedConnected && cachedWaiter) {
    return { ws: cachedWs, waiter: cachedWaiter }
  }

  if (connectionPromise) {
    await connectionPromise
    if (cachedWs && cachedWs.readyState === WebSocket.OPEN && cachedConnected && cachedWaiter) {
      return { ws: cachedWs, waiter: cachedWaiter }
    }
  }

  resetCachedConnection()

  const { url, token, password } = getGatewayConfig()

  connectionPromise = (async () => {
    const ws = new WebSocket(url)
    const waiter = createGatewayWaiter()

    ws.addEventListener('message', waiter.handleMessage)
    ws.addEventListener('close', () => {
      resetCachedConnection()
    })
    ws.addEventListener('error', () => {
      resetCachedConnection()
    })

    await wsOpen(ws)

    const connectId = randomUUID()
    const connectParams = buildConnectParams(token, password)
    const connectReq: GatewayFrame = {
      type: 'req',
      id: connectId,
      method: 'connect',
      params: connectParams,
    }

    ws.send(JSON.stringify(connectReq))
    await waiter.waitForRes(connectId)

    cachedWs = ws
    cachedWaiter = waiter
    cachedConnected = true
  })()

  await connectionPromise
  connectionPromise = null

  return { ws: cachedWs!, waiter: cachedWaiter! }
}

export async function gatewayRpc<TPayload = unknown>(
  method: string,
  params?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<TPayload> {
  const { ws, waiter } = await getConnection()

  const requestId = randomUUID()
  const req: GatewayFrame = {
    type: 'req',
    id: requestId,
    method,
    params,
  }

  ws.send(JSON.stringify(req))
  const payload = await waiter.waitForRes(requestId, timeoutMs)
  return payload as TPayload
}

export async function gatewayConnectCheck(): Promise<void> {
  await getConnection()
}
