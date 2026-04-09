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

// Cached schema mappings (property key IDs → names, label IDs → names)
let propertyKeys: Array<string> | null = null
let labelNames: Array<string> | null = null

async function ensureSchemaCached(): Promise<void> {
  if (propertyKeys && labelNames) return
  const r = getRedis()

  const pkResult = await r.call(
    'GRAPH.QUERY',
    'knowledge_graph',
    'CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey',
    '--compact',
  )
  propertyKeys = extractScalarList(pkResult)

  const lbResult = await r.call(
    'GRAPH.QUERY',
    'knowledge_graph',
    'CALL db.labels() YIELD label RETURN label',
    '--compact',
  )
  labelNames = extractScalarList(lbResult)
}

function extractScalarList(raw: unknown): Array<string> {
  if (!Array.isArray(raw) || raw.length < 2) return []
  const dataRows = raw[1]
  if (!Array.isArray(dataRows)) return []
  return dataRows.map(function extractVal(row: unknown) {
    if (!Array.isArray(row) || !Array.isArray(row[0])) return ''
    // Each row is [[typeId, value]]
    return String(row[0][1] ?? '')
  })
}

// FalkorDB compact node format: [8, [internalId, [labelIndices], [[propKeyId, typeId, value], ...]]]
function parseCompactNode(raw: unknown): Record<string, unknown> | null {
  if (!Array.isArray(raw)) return null

  // Check if this is a node wrapper [8, payload]
  let payload: unknown
  if (raw[0] === 8 && Array.isArray(raw[1])) {
    payload = raw[1]
  } else if (Array.isArray(raw[0])) {
    // Might already be unwrapped — try the old format as fallback
    payload = raw
  } else {
    return null
  }

  if (!Array.isArray(payload)) return null

  const props: Record<string, unknown> = {}

  // Payload: [internalId, [labelIndices], [[propKeyId, typeId, value], ...]]
  const labelIndices = payload[1]
  if (Array.isArray(labelIndices) && labelNames) {
    const firstLabel = labelIndices[0]
    if (typeof firstLabel === 'number' && labelNames[firstLabel]) {
      props._label = labelNames[firstLabel]
    }
  }

  const properties = payload[2]
  if (Array.isArray(properties)) {
    for (const prop of properties) {
      if (Array.isArray(prop) && prop.length >= 3) {
        const keyId = prop[0]
        const value = prop[2]
        // Resolve property key ID to name
        const keyName =
          typeof keyId === 'number' && propertyKeys
            ? (propertyKeys[keyId] ?? String(keyId))
            : String(keyId)
        props[keyName] = value
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
  await ensureSchemaCached()
  const r = getRedis()
  const result = await r.call(
    'GRAPH.QUERY',
    'knowledge_graph',
    cypher,
    '--compact',
  )
  return parseResultSet(result)
}

// Unwrap a compact scalar value: [typeId, value] → value
function unwrapScalar(raw: unknown): unknown {
  if (Array.isArray(raw) && raw.length === 2 && typeof raw[0] === 'number') {
    return raw[1]
  }
  return raw
}

export { parseCompactNode, unwrapScalar }
