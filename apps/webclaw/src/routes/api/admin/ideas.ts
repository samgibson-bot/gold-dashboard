import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'
import {
  listIdeaBranches,
  fetchBranchReadme,
  listOpenPRs,
  parseIdeaReadme,
  branchUrl,
} from '../../../server/github'

export const Route = createFileRoute('/api/admin/ideas')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [branches, prs] = await Promise.all([
            listIdeaBranches(),
            listOpenPRs(),
          ])

          const prByBranch = new Map(
            prs.map(function mapPr(pr) {
              return [
                pr.head.ref,
                { number: pr.number, url: pr.html_url, title: pr.title },
              ]
            }),
          )

          const ideas = await Promise.all(
            branches.map(async function fetchIdea(branch) {
              const slug = branch.replace('idea/', '')
              const content = await fetchBranchReadme(branch)
              const meta = content
                ? parseIdeaReadme(content)
                : { title: slug, status: 'unknown', created: '', tags: [], topic: '' }

              const pr = prByBranch.get(branch)

              return {
                path: branch,
                slug,
                title: meta.title || slug,
                status: pr ? 'reviewing' : meta.status,
                created: meta.created,
                tags: meta.tags,
                content: content ?? '',
                branch,
                githubUrl: branchUrl(branch),
                prNumber: pr?.number,
                prUrl: pr?.url,
              }
            }),
          )

          return json({
            ok: true,
            ideas: { files: ideas },
          })
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
