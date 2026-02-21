import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'

async function readFile(path: string): Promise<string | null> {
  try {
    const result = await gatewayRpc<{ content?: string }>('fs.readFile', {
      path,
    })
    return result.content ?? null
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
    return result.entries ?? []
  } catch {
    return []
  }
}

function validatePath(path: string): string | null {
  if (!path) return 'path is required'
  if (path.includes('..')) return 'Path traversal not allowed'
  if (!path.startsWith('.openclaw/') && path !== '.openclaw')
    return 'Path must be within .openclaw/'
  return null
}

export const Route = createFileRoute('/api/admin/files')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const action = url.searchParams.get('action') ?? ''
          const path = url.searchParams.get('path') ?? ''

          if (action === 'list') {
            const pathError = validatePath(path || '.openclaw')
            if (pathError) {
              return json({ ok: false, error: pathError }, { status: 400 })
            }

            const targetPath = path || '.openclaw'
            const entries = await listDir(targetPath)

            return json({
              ok: true,
              path: targetPath,
              entries: entries.map(function mapEntry(e) {
                return {
                  name: e.name,
                  path: `${targetPath}/${e.name}`,
                  type: e.type,
                  modified: e.modified,
                }
              }),
            })
          }

          if (action === 'read') {
            const pathError = validatePath(path)
            if (pathError) {
              return json({ ok: false, error: pathError }, { status: 400 })
            }

            const content = await readFile(path)
            if (content === null) {
              return json(
                { ok: false, error: 'File not found or unreadable' },
                { status: 404 },
              )
            }

            return json({ ok: true, path, content })
          }

          return json(
            { ok: false, error: `Unknown action: ${action}` },
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

          if (action === 'write') {
            const path = typeof body.path === 'string' ? body.path.trim() : ''
            const content =
              typeof body.content === 'string' ? body.content : null

            const pathError = validatePath(path)
            if (pathError) {
              return json({ ok: false, error: pathError }, { status: 400 })
            }
            if (content === null) {
              return json(
                { ok: false, error: 'content is required' },
                { status: 400 },
              )
            }
            if (content.length > 500 * 1024) {
              return json(
                { ok: false, error: 'Content exceeds 500KB limit' },
                { status: 400 },
              )
            }
            if (path.endsWith('openclaw.json')) {
              return json(
                {
                  ok: false,
                  error:
                    'openclaw.json cannot be edited here — use SSH and restart the gateway',
                },
                { status: 400 },
              )
            }

            await gatewayRpc('fs.writeFile', { path, content })
            return json({ ok: true })
          }

          if (action === 'delete') {
            const path = typeof body.path === 'string' ? body.path.trim() : ''

            const pathError = validatePath(path)
            if (pathError) {
              return json({ ok: false, error: pathError }, { status: 400 })
            }

            const protectedPaths = [
              '.openclaw',
              '.openclaw/openclaw.json',
              '.openclaw/workspace/SOUL.md',
            ]
            if (protectedPaths.includes(path)) {
              return json(
                {
                  ok: false,
                  error: 'This file is protected and cannot be deleted',
                },
                { status: 400 },
              )
            }

            await gatewayRpc('fs.deleteFile', { path })
            return json({ ok: true })
          }

          if (action === 'rename') {
            const oldPath =
              typeof body.oldPath === 'string' ? body.oldPath.trim() : ''
            const newPath =
              typeof body.newPath === 'string' ? body.newPath.trim() : ''

            const oldError = validatePath(oldPath)
            if (oldError) {
              return json(
                { ok: false, error: `Old path: ${oldError}` },
                { status: 400 },
              )
            }
            const newError = validatePath(newPath)
            if (newError) {
              return json(
                { ok: false, error: `New path: ${newError}` },
                { status: 400 },
              )
            }

            // Check if new path already exists
            const existing = await readFile(newPath)
            if (existing !== null) {
              return json(
                { ok: false, error: 'A file with that name already exists' },
                { status: 409 },
              )
            }

            // Read old → write new → delete old
            const content = await readFile(oldPath)
            if (content === null) {
              return json(
                { ok: false, error: 'Source file not found' },
                { status: 404 },
              )
            }

            await gatewayRpc('fs.writeFile', { path: newPath, content })
            await gatewayRpc('fs.deleteFile', { path: oldPath })
            return json({ ok: true })
          }

          if (action === 'mkdir') {
            const path = typeof body.path === 'string' ? body.path.trim() : ''

            const pathError = validatePath(path)
            if (pathError) {
              return json({ ok: false, error: pathError }, { status: 400 })
            }

            // Write a .gitkeep to create the directory
            await gatewayRpc('fs.writeFile', {
              path: `${path}/.gitkeep`,
              content: '',
            })
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
