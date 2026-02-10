const OWNER = 'samgibson-bot'
const REPO = 'gold-ideas-factory'
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
