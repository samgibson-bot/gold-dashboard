import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { sanitizeError } from '../../../server/errors'
import {
  listIdeaBranches,
  fetchBranchReadme,
  listOpenPRs,
  parseIdeaReadme,
  branchUrl,
  listIdeaFilesOnMain,
  parseFrontmatter,
  createIdea,
} from '../../../server/github'
import type { CreateIdeaInput } from '../../../server/github'

export const Route = createFileRoute('/api/admin/ideas')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [branches, prs, mainFiles] = await Promise.all([
            listIdeaBranches(),
            listOpenPRs(),
            listIdeaFilesOnMain(),
          ])

          const prByBranch = new Map(
            prs.map(function mapPr(pr) {
              return [
                pr.head.ref,
                { number: pr.number, url: pr.html_url, title: pr.title },
              ]
            }),
          )

          // Build a set of slugs we've already seen from main files
          const seenSlugs = new Set<string>()

          // Parse ideas from main branch files (primary source)
          const mainIdeas = mainFiles.map(function parseMainFile(file) {
            seenSlugs.add(file.slug)
            const fm = parseFrontmatter(file.content)
            const title = (fm.title as string) || file.slug
            const status = (fm.status as string) || 'seed'
            const created = (fm.created as string) || ''
            const tags = Array.isArray(fm.tags) ? (fm.tags as Array<string>) : []
            const issueNum = fm.issue ? Number(fm.issue) : undefined
            const branch = (fm.branch as string) || ''
            const pr = branch ? prByBranch.get(branch) : undefined

            return {
              path: file.path,
              slug: file.slug,
              title,
              status: pr ? 'reviewing' : status,
              created,
              tags,
              content: file.content,
              branch: branch || undefined,
              githubUrl: branch ? branchUrl(branch) : undefined,
              prNumber: pr?.number,
              prUrl: pr?.url,
              issueNumber: issueNum,
              issueUrl: issueNum
                ? `https://github.com/samgibson-bot/gold-ideas/issues/${issueNum}`
                : undefined,
            }
          })

          // Also include branch-only ideas (those without a file on main)
          const branchOnlyIdeas = await Promise.all(
            branches
              .filter(function notOnMain(branch) {
                const slug = branch.replace('idea/', '')
                return !seenSlugs.has(slug)
              })
              .map(async function fetchIdea(branch) {
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
                  issueNumber: undefined as number | undefined,
                  issueUrl: undefined as string | undefined,
                }
              }),
          )

          const ideas = [...mainIdeas, ...branchOnlyIdeas]

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
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const title = typeof body.title === 'string' ? body.title.trim() : ''
          const description =
            typeof body.description === 'string' ? body.description.trim() : ''
          const tags = Array.isArray(body.tags)
            ? (body.tags as Array<string>).filter(
                function isString(t) { return typeof t === 'string' },
              )
            : []

          if (!title) {
            return json(
              { ok: false, error: 'Title is required' },
              { status: 400 },
            )
          }
          if (!description) {
            return json(
              { ok: false, error: 'Description is required' },
              { status: 400 },
            )
          }

          const input: CreateIdeaInput = { title, description, tags }
          const result = await createIdea(input)

          return json({ ok: true, result })
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
