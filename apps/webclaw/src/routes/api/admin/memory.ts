import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

async function readFile(path: string): Promise<string | null> {
  try {
    const result = await gatewayRpc<{ content?: string }>('fs.readFile', {
      path,
    })
    return result?.content ?? null
  } catch {
    return null
  }
}

async function listDir(
  path: string,
): Promise<Array<{ name: string; type: string; modified?: string }>> {
  try {
    const result = await gatewayRpc<{
      entries?: Array<{ name: string; type: string; modified?: string }>
    }>('fs.listDir', { path })
    return result?.entries ?? []
  } catch {
    return []
  }
}

export const Route = createFileRoute('/api/admin/memory')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const section = url.searchParams.get('section') ?? 'workspace'

          if (section === 'workspace') {
            const [soul, memory, agents] = await Promise.all([
              readFile('SOUL.md'),
              readFile('MEMORY.md'),
              readFile('AGENTS.md'),
            ])

            return json({
              ok: true,
              workspace: { soul, memory, agents },
            })
          }

          if (section === 'shared-context') {
            const dir = url.searchParams.get('dir') ?? ''
            const basePath = '.openclaw/shared-context'
            const fullPath = dir ? `${basePath}/${dir}` : basePath

            const entries = await listDir(fullPath)

            return json({
              ok: true,
              path: fullPath,
              entries: entries.map(function mapEntry(e) {
                return {
                  name: e.name,
                  path: `${fullPath}/${e.name}`,
                  type: e.type,
                  modified: e.modified,
                }
              }),
            })
          }

          if (section === 'file') {
            const filePath = url.searchParams.get('path') ?? ''
            if (!filePath) {
              return json(
                { ok: false, error: 'path is required' },
                { status: 400 },
              )
            }
            const content = await readFile(filePath)
            return json({ ok: true, content: content ?? '' })
          }

          return json(
            { ok: false, error: `Unknown section: ${section}` },
            { status: 400 },
          )
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

          if (action === 'update_priorities') {
            const content = typeof body.content === 'string' ? body.content : ''
            if (!content) {
              return json(
                { ok: false, error: 'content is required' },
                { status: 400 },
              )
            }

            await gatewayRpc('fs.writeFile', {
              path: '.openclaw/shared-context/priorities.md',
              content,
            })

            return json({ ok: true })
          }

          if (action === 'write_file') {
            const path = typeof body.path === 'string' ? body.path.trim() : ''
            const content =
              typeof body.content === 'string' ? body.content : null

            if (!path) {
              return json(
                { ok: false, error: 'path is required' },
                { status: 400 },
              )
            }
            if (content === null) {
              return json(
                { ok: false, error: 'content is required' },
                { status: 400 },
              )
            }

            // Safety whitelist — only allow writes to known safe paths
            const allowedPrefixes = [
              '.openclaw/workspace/',
              '.openclaw/souls/',
              '.openclaw/skills/',
              '.openclaw/shared-context/',
            ]
            const isAllowed = allowedPrefixes.some((prefix) =>
              path.startsWith(prefix),
            )
            if (!isAllowed) {
              return json(
                {
                  ok: false,
                  error: `Path not allowed. Must start with one of: ${allowedPrefixes.join(', ')}`,
                },
                { status: 400 },
              )
            }

            await gatewayRpc('fs.writeFile', { path, content })
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
