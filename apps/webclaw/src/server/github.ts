const OWNER = 'samgibson-bot'
const REPO = 'gold-ideas'
const API_BASE = 'https://api.github.com'

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'Missing GITHUB_TOKEN. Set it in the server environment to enable GitHub integration.',
    )
  }
  return token
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getGitHubToken()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

type GitHubBranch = {
  name: string
}

type GitHubContent = {
  content?: string
  encoding?: string
}

type GitHubPR = {
  number: number
  title: string
  state: string
  html_url: string
  head: { ref: string }
}

export type IdeaMeta = {
  title: string
  status: string
  created: string
  tags: Array<string>
  topic: string
}

export async function listIdeaBranches(): Promise<Array<string>> {
  const res = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/branches?per_page=100`,
    { headers: headers() },
  )
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const branches = (await res.json()) as Array<GitHubBranch>
  return branches
    .map(function getName(b) {
      return b.name
    })
    .filter(function isIdea(name) {
      return name.startsWith('idea/')
    })
}

export async function fetchBranchReadme(
  branch: string,
): Promise<string | null> {
  const res = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/contents/README.md?ref=${encodeURIComponent(branch)}`,
    { headers: headers() },
  )
  if (!res.ok) return null
  const data = (await res.json()) as GitHubContent
  if (!data.content) return null
  return Buffer.from(data.content, 'base64').toString('utf-8')
}

export async function listOpenPRs(): Promise<Array<GitHubPR>> {
  const res = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/pulls?state=open&per_page=100`,
    { headers: headers() },
  )
  if (!res.ok) return []
  return (await res.json()) as Array<GitHubPR>
}

export function parseIdeaReadme(content: string): IdeaMeta {
  const meta: IdeaMeta = {
    title: '',
    status: 'unknown',
    created: '',
    tags: [],
    topic: '',
  }

  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Format A: # Idea: Title Here
    const headingMatch = trimmed.match(/^#\s+(?:Idea:\s*)?(.+)/)
    if (headingMatch && !meta.title) {
      meta.title = headingMatch[1].trim()
    }

    // Format A: **Status**: `seed`
    const statusMatchA = trimmed.match(
      /\*\*Status\*\*\s*:\s*`?([^`\n]+)`?/i,
    )
    if (statusMatchA) {
      meta.status = statusMatchA[1].trim()
    }

    // Format A: **Date**: 2026-02-09
    const dateMatchA = trimmed.match(/\*\*Date\*\*\s*:\s*(.+)/i)
    if (dateMatchA) {
      meta.created = dateMatchA[1].trim()
    }

    // Format A: **Topic**: Category
    const topicMatch = trimmed.match(/\*\*Topic\*\*\s*:\s*(.+)/i)
    if (topicMatch) {
      meta.topic = topicMatch[1].trim()
    }

    // Format B: Title: Title Here
    if (trimmed.startsWith('Title:') && !meta.title) {
      meta.title = trimmed.replace('Title:', '').trim()
    }

    // Format B: Status: seed
    if (trimmed.startsWith('Status:') && meta.status === 'unknown') {
      meta.status = trimmed.replace('Status:', '').trim()
    }

    // Format B: Created: 2026-02-07
    if (trimmed.startsWith('Created:') && !meta.created) {
      meta.created = trimmed.replace('Created:', '').trim()
    }

    // Format B: Tags: #tag1 #tag2
    if (trimmed.startsWith('Tags:')) {
      const tagStr = trimmed.replace('Tags:', '').trim()
      meta.tags = tagStr
        .split(/\s+/)
        .map(function cleanTag(t) {
          return t.replace(/^#/, '')
        })
        .filter(Boolean)
    }
  }

  return meta
}

export function branchUrl(branch: string): string {
  return `https://github.com/${OWNER}/${REPO}/tree/${encodeURIComponent(branch)}`
}

// ---------- Idea file listing from main branch ----------

type GitHubTreeItem = {
  path: string
  type: string
  sha: string
}

type GitHubTree = {
  tree: Array<GitHubTreeItem>
}

export async function listIdeaFilesOnMain(): Promise<
  Array<{ path: string; slug: string; content: string }>
> {
  // Get the tree for ideas/ directory on main
  const res = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/git/trees/main?recursive=1`,
    { headers: headers() },
  )
  if (!res.ok) throw new Error(`GitHub tree API error: ${res.status}`)
  const tree = (await res.json()) as GitHubTree

  // Filter to top-level markdown files under ideas/ (e.g. "ideas/foo.md")
  const mdFiles = tree.tree.filter(function isIdeaMd(item) {
    return (
      item.type === 'blob' &&
      item.path.startsWith('ideas/') &&
      item.path.endsWith('.md') &&
      item.path.split('/').length === 2 // exactly ideas/<name>.md
    )
  })

  const results = await Promise.all(
    mdFiles.map(async function fetchFile(item) {
      const slug = item.path.replace('ideas/', '').replace('.md', '')
      const contentRes = await fetch(
        `${API_BASE}/repos/${OWNER}/${REPO}/contents/${item.path}?ref=main`,
        { headers: headers() },
      )
      if (!contentRes.ok) return { path: item.path, slug, content: '' }
      const data = (await contentRes.json()) as GitHubContent
      const content = data.content
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : ''
      return { path: item.path, slug, content }
    }),
  )

  return results
}

// ---------- Parse YAML frontmatter ----------

export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const yaml = match[1]
  const result: Record<string, unknown> = {}
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value: unknown = line.slice(colonIdx + 1).trim()
    // Handle arrays like [tag1, tag2]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(function trimVal(v) { return v.trim() })
        .filter(Boolean)
    }
    // Strip quotes
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

// ---------- Create idea: GitHub Issue + file on main ----------

export type CreateIdeaInput = {
  title: string
  description: string
  tags: Array<string>
}

export type CreateIdeaResult = {
  issueNumber: number
  issueUrl: string
  filePath: string
  slug: string
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export async function createIdea(input: CreateIdeaInput): Promise<CreateIdeaResult> {
  const slug = slugify(input.title)
  const today = new Date().toISOString().slice(0, 10)

  // 1. Create GitHub Issue
  const issueBody = `## ${input.title}\n\n${input.description}\n\n---\n*Created via Gold Dashboard*`
  const labels = ['idea', 'seed', ...input.tags.slice(0, 5)]

  const issueRes = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/issues`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        title: input.title,
        body: issueBody,
        labels,
      }),
    },
  )
  if (!issueRes.ok) {
    const errText = await issueRes.text()
    throw new Error(`Failed to create issue: ${issueRes.status} ${errText}`)
  }
  const issue = (await issueRes.json()) as { number: number; html_url: string }

  // 2. Create markdown file on main branch
  const filePath = `ideas/${slug}.md`
  const fileContent = `---
title: "${input.title}"
slug: ${slug}
status: seed
created: ${today}
tags: [${input.tags.join(', ')}]
issue: ${issue.number}
branch: 
---

# ${input.title}

${input.description}
`
  const encodedContent = Buffer.from(fileContent).toString('base64')

  const fileRes = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        message: `Add idea: ${input.title}`,
        content: encodedContent,
        branch: 'main',
      }),
    },
  )
  if (!fileRes.ok) {
    const errText = await fileRes.text()
    throw new Error(`Failed to create file: ${fileRes.status} ${errText}`)
  }

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    filePath,
    slug,
  }
}
