import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({ host: '127.0.0.1', port: 16379, lazyConnect: true })
    redis.on('error', function onError(err) {
      console.error('[falkordb] connection error:', err.message)
    })
  }
  return redis
}

type FalkorResult = {
  headers: Array<string>
  rows: Array<Array<unknown>>
}

function parseCompactNode(raw: unknown): Record<string, unknown> | null {
  if (!Array.isArray(raw)) return null
  // FalkorDB compact format: [[properties], [labels], id]
  // Properties are [[name, type, value], ...]
  const props: Record<string, unknown> = {}
  const properties = raw[0]
  if (Array.isArray(properties)) {
    for (const prop of properties) {
      if (Array.isArray(prop) && prop.length >= 3) {
        props[prop[0] as string] = prop[2]
      }
    }
  }
  return props
}

function parseResultSet(raw: unknown): FalkorResult {
  if (!Array.isArray(raw) || raw.length < 2) {
    return { headers: [], rows: [] }
  }
  const headerRow = raw[0]
  const dataRows = raw[1]
  const headers: Array<string> = Array.isArray(headerRow)
    ? headerRow.map(function extractName(h: unknown) {
        if (Array.isArray(h)) return String(h[1] ?? h[0] ?? '')
        return String(h ?? '')
      })
    : []
  const rows: Array<Array<unknown>> = Array.isArray(dataRows) ? dataRows : []
  return { headers, rows }
}

export async function graphQuery(cypher: string): Promise<FalkorResult> {
  const r = getRedis()
  const result = await r.call(
    'GRAPH.QUERY',
    'knowledge_graph',
    cypher,
    '--compact',
  )
  return parseResultSet(result)
}

export { parseCompactNode }
