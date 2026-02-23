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

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value: unknown = line.slice(colonIdx + 1).trim()
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (typeof value === 'string' && !isNaN(Number(value)) && value !== '')
      value = Number(value)
    frontmatter[key] = value
  }
  return { frontmatter, body: match[2] }
}

export const Route = createFileRoute('/api/admin/skills')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const entries = await listDir('.openclaw/skills')
          const dirs = entries.filter(function isDir(e) {
            return e.type === 'directory'
          })

          const skills = await Promise.all(
            dirs.map(async function loadSkill(dir) {
              const path = `.openclaw/skills/${dir.name}/SKILL.md`
              const content = await readFile(path)
              if (!content) return null

              const { frontmatter, body } = parseFrontmatter(content)
              return {
                name: String(frontmatter.name ?? dir.name),
                description: String(frontmatter.description ?? ''),
                version: String(frontmatter.version ?? ''),
                trigger: frontmatter.trigger
                  ? String(frontmatter.trigger)
                  : undefined,
                on_demand: Boolean(frontmatter.on_demand ?? false),
                agent: frontmatter.agent
                  ? String(frontmatter.agent)
                  : undefined,
                schedule: frontmatter.schedule
                  ? String(frontmatter.schedule)
                  : undefined,
                source: 'shared' as const,
                path,
                frontmatter,
                body,
              }
            }),
          )

          return json({
            ok: true,
            skills: skills.filter(Boolean),
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

          if (action === 'read') {
            const name = typeof body.name === 'string' ? body.name.trim() : ''
            if (!name) {
              return json(
                { ok: false, error: 'name is required' },
                { status: 400 },
              )
            }

            const path = `.openclaw/skills/${name}/SKILL.md`
            const content = await readFile(path)
            if (content === null) {
              return json(
                { ok: false, error: `Skill "${name}" not found` },
                { status: 404 },
              )
            }

            const { frontmatter, body: skillBody } = parseFrontmatter(content)
            return json({
              ok: true,
              skill: { name, path, frontmatter, body: skillBody, raw: content },
            })
          }

          if (action === 'create') {
            const name = typeof body.name === 'string' ? body.name.trim() : ''
            const content = typeof body.content === 'string' ? body.content : ''
            if (!name) {
              return json(
                { ok: false, error: 'name is required' },
                { status: 400 },
              )
            }
            if (!content) {
              return json(
                { ok: false, error: 'content is required' },
                { status: 400 },
              )
            }
            if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
              return json(
                {
                  ok: false,
                  error:
                    'Skill name must be lowercase alphanumeric with hyphens',
                },
                { status: 400 },
              )
            }

            const existing = await readFile(`.openclaw/skills/${name}/SKILL.md`)
            if (existing !== null) {
              return json(
                { ok: false, error: `Skill "${name}" already exists` },
                { status: 409 },
              )
            }

            const path = `.openclaw/skills/${name}/SKILL.md`
            await gatewayRpc('fs.writeFile', { path, content })
            return json({ ok: true, path })
          }

          if (action === 'update') {
            const name = typeof body.name === 'string' ? body.name.trim() : ''
            const content = typeof body.content === 'string' ? body.content : ''
            if (!name) {
              return json(
                { ok: false, error: 'name is required' },
                { status: 400 },
              )
            }
            if (!content) {
              return json(
                { ok: false, error: 'content is required' },
                { status: 400 },
              )
            }

            const path = `.openclaw/skills/${name}/SKILL.md`
            const existing = await readFile(path)
            if (existing === null) {
              return json(
                { ok: false, error: `Skill "${name}" not found` },
                { status: 404 },
              )
            }

            await gatewayRpc('fs.writeFile', { path, content })
            return json({ ok: true })
          }

          if (action === 'delete') {
            const name = typeof body.name === 'string' ? body.name.trim() : ''
            if (!name) {
              return json(
                { ok: false, error: 'name is required' },
                { status: 400 },
              )
            }

            const path = `.openclaw/skills/${name}/SKILL.md`
            const existing = await readFile(path)
            if (existing === null) {
              return json(
                { ok: false, error: `Skill "${name}" not found` },
                { status: 404 },
              )
            }

            // Soft-delete: save backup then clear original
            await gatewayRpc('fs.writeFile', {
              path: `.openclaw/skills/${name}/SKILL.md.disabled`,
              content: existing,
            })
            try {
              await gatewayRpc('fs.deleteFile', { path })
            } catch {
              await gatewayRpc('fs.writeFile', { path, content: '' })
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
