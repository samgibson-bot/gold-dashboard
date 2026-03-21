import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'

const OWNER = 'samgibson-bot'
const REPO = 'gold-ideas'
const API_BASE = 'https://api.github.com'

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) throw new Error('Missing GITHUB_TOKEN')
  return token
}

export const Route = createFileRoute('/api/admin/ideas/publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const issueNumber =
            typeof body.issueNumber === 'number' ? body.issueNumber : 0

          if (!issueNumber) {
            return json(
              { ok: false, error: 'issueNumber is required' },
              { status: 400 },
            )
          }

          const res = await fetch(
            `${API_BASE}/repos/${OWNER}/${REPO}/issues/${issueNumber}/labels/needs-review`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${getGitHubToken()}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
              },
            },
          )

          if (!res.ok && res.status !== 404) {
            throw new Error(`GitHub API error: ${res.status}`)
          }

          return json({ ok: true })
        } catch (err) {
          return json(
            { ok: false, error: sanitizeError(err) },
            { status: 500 },
          )
        }
      },
    },
  },
})
