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

// ---------- Types ----------

type GitHubLabel = {
  name: string
}

type GitHubIssue = {
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  created_at: string
  labels: Array<GitHubLabel>
  pull_request?: { html_url: string }
}

export type IdeaFromGitHub = {
  issueNumber: number
  title: string
  status: string
  tags: Array<string>
  content: string
  created: string
  issueUrl: string
  prNumber?: number
  prUrl?: string
}

const STATUS_LABELS = [
  'seed',
  'elaborating',
  'reviewing',
  'validated',
  'building',
  'completed',
  'archived',
]

// ---------- List ideas ----------

export async function listIdeas(): Promise<Array<IdeaFromGitHub>> {
  const res = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/issues?labels=idea&state=all&per_page=100`,
    { headers: headers() },
  )
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const issues = (await res.json()) as Array<GitHubIssue>

  return issues.map(function mapIssue(issue) {
    const labelNames = issue.labels.map(function getName(l) {
      return l.name
    })
    const status =
      labelNames.find(function isStatus(l) {
        return STATUS_LABELS.includes(l)
      }) ?? 'seed'
    const tags = labelNames.filter(function isTag(l) {
      return l !== 'idea' && !STATUS_LABELS.includes(l)
    })

    return {
      issueNumber: issue.number,
      title: issue.title,
      status,
      tags,
      content: issue.body ?? '',
      created: issue.created_at,
      issueUrl: issue.html_url,
      prNumber: issue.pull_request ? issue.number : undefined,
      prUrl: issue.pull_request?.html_url,
    }
  })
}

// ---------- Create idea ----------

export type CreateIdeaInput = {
  title: string
  description: string
  tags: Array<string>
}

export type CreateIdeaResult = {
  issueNumber: number
  issueUrl: string
}

export async function createIdea(
  input: CreateIdeaInput,
): Promise<CreateIdeaResult> {
  const issueBody = [
    `## ${input.title}`,
    '',
    input.description,
    '',
    '---',
    '',
    '### Expansion Request',
    '',
    'When this idea is picked up for elaboration, generate an **expansive 5-10 point roadmap** covering:',
    '1. Problem definition and target users',
    '2. Core technical architecture',
    '3. Key dependencies and prerequisites',
    '4. MVP scope and deliverables',
    '5. Data model / API design',
    '6. Integration points with existing systems',
    '7. Testing and validation strategy',
    '8. Deployment and infrastructure needs',
    '9. Risks, unknowns, and mitigation',
    '10. Future extensions and scaling considerations',
    '',
    '---',
    '*Created via Gold Dashboard*',
  ].join('\n')
  const labels = ['idea', 'seed', ...input.tags.slice(0, 5)]

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      title: input.title,
      body: issueBody,
      labels,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to create issue: ${res.status} ${errText}`)
  }
  const issue = (await res.json()) as { number: number; html_url: string }

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  }
}

// ---------- Search related issues (keyword relevance, not fixed N) ----------

type SearchResult = {
  number: number
  title: string
  state: string
  body: string | null
  html_url: string
  labels: Array<GitHubLabel>
}

type GitHubSearchResponse = {
  total_count: number
  items: Array<SearchResult>
}

/**
 * Search gold-ideas for issues related to a query string.
 * Uses GitHub search API for keyword relevance ranking across all states.
 */
export async function searchRelatedIssues(
  query: string,
  opts?: { maxResults?: number },
): Promise<
  Array<{
    number: number
    title: string
    state: string
    url: string
    snippet: string
  }>
> {
  const max = opts?.maxResults ?? 10
  const q = encodeURIComponent(`${query} repo:${OWNER}/${REPO} label:idea`)
  const res = await fetch(
    `${API_BASE}/search/issues?q=${q}&per_page=${max}&sort=relevance`,
    { headers: headers() },
  )
  if (!res.ok) return [] // Degrade gracefully — search is supplementary
  const data = (await res.json()) as GitHubSearchResponse

  return data.items.map(function mapResult(item) {
    const bodySnippet = item.body
      ? item.body.slice(0, 200).replace(/\n/g, ' ')
      : ''
    return {
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.html_url,
      snippet: bodySnippet,
    }
  })
}

/**
 * Search across multiple repos for issues/PRs related to a query.
 * Uses GitHub search API — repos are passed as a list of "owner/repo" strings.
 */
export async function searchAcrossRepos(
  query: string,
  repos: Array<string>,
  opts?: { maxResults?: number },
): Promise<
  Array<{
    number: number
    title: string
    state: string
    url: string
    repo: string
    snippet: string
  }>
> {
  if (repos.length === 0) return []
  const max = opts?.maxResults ?? 10
  const repoFilters = repos
    .map(function toFilter(r) {
      return `repo:${r}`
    })
    .join('+')
  const q = encodeURIComponent(`${query}`) + `+${repoFilters}`
  const res = await fetch(
    `${API_BASE}/search/issues?q=${q}&per_page=${max}&sort=relevance`,
    { headers: headers() },
  )
  if (!res.ok) return []
  const data = (await res.json()) as GitHubSearchResponse

  return data.items.map(function mapResult(item) {
    // Extract repo from html_url: https://github.com/owner/repo/issues/N
    const urlParts = item.html_url.split('/')
    const repo = `${urlParts[3]}/${urlParts[4]}`
    const bodySnippet = item.body
      ? item.body.slice(0, 200).replace(/\n/g, ' ')
      : ''
    return {
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.html_url,
      repo,
      snippet: bodySnippet,
    }
  })
}

// ---------- Fleet repo discovery (cached) ----------

type GitHubRepo = {
  name: string
  full_name: string
  pushed_at: string
  archived: boolean
  fork: boolean
}

const PINNED_REPOS = [
  'samgibson-bot/gold-dashboard',
  'samgibson-bot/gold-ideas',
]

let fleetReposCache: { repos: Array<string>; fetchedAt: number } | null = null
const FLEET_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Get the list of active fleet repos. Uses GitHub API with a 6-hour cache.
 * Falls back to pinned repos if the API call fails.
 */
export async function getFleetRepos(): Promise<Array<string>> {
  if (
    fleetReposCache &&
    Date.now() - fleetReposCache.fetchedAt < FLEET_CACHE_TTL
  ) {
    return fleetReposCache.repos
  }

  try {
    const res = await fetch(
      `${API_BASE}/users/${OWNER}/repos?per_page=100&sort=pushed&direction=desc`,
      { headers: headers() },
    )
    if (!res.ok) return PINNED_REPOS

    const repos = (await res.json()) as Array<GitHubRepo>
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000

    const activeRepos = repos
      .filter(function isActive(r) {
        if (r.archived) return false
        if (r.name.startsWith('.') || r.name === OWNER) return false
        const pushedAt = new Date(r.pushed_at).getTime()
        return pushedAt > ninetyDaysAgo || PINNED_REPOS.includes(r.full_name)
      })
      .map(function toFullName(r) {
        return r.full_name
      })

    // Ensure pinned repos are always included
    for (const pinned of PINNED_REPOS) {
      if (!activeRepos.includes(pinned)) {
        activeRepos.push(pinned)
      }
    }

    fleetReposCache = { repos: activeRepos, fetchedAt: Date.now() }
    return activeRepos
  } catch {
    return PINNED_REPOS
  }
}

// ---------- Update idea status (label swap) ----------

export async function updateIdeaStatus(
  issueNumber: number,
  newStatus: string,
): Promise<void> {
  // Get current labels
  const getRes = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/issues/${issueNumber}`,
    { headers: headers() },
  )
  if (!getRes.ok) {
    throw new Error(
      `GitHub API error fetching issue #${issueNumber}: ${getRes.status}`,
    )
  }
  const issue = (await getRes.json()) as GitHubIssue

  // Remove old status labels, add new one
  const currentLabels = issue.labels.map(function getName(l) {
    return l.name
  })
  const newLabels = currentLabels
    .filter(function removeOldStatus(l) {
      return !STATUS_LABELS.includes(l)
    })
    .concat(newStatus)

  // Ensure 'idea' label is present
  if (!newLabels.includes('idea')) {
    newLabels.push('idea')
  }

  const updateRes = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ labels: newLabels }),
    },
  )

  if (!updateRes.ok) {
    const errBody = await updateRes.text().catch(function fallback() {
      return ''
    })
    throw new Error(
      `GitHub API error updating issue #${issueNumber}: ${updateRes.status} ${errBody}`,
    )
  }
}
