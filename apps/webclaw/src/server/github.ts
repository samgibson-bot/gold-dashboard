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
    const status = labelNames.find(function isStatus(l) {
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

export async function createIdea(input: CreateIdeaInput): Promise<CreateIdeaResult> {
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

  const res = await fetch(
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
    throw new Error(`GitHub API error fetching issue #${issueNumber}: ${getRes.status}`)
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
    const errBody = await updateRes.text().catch(function fallback() { return '' })
    throw new Error(`GitHub API error updating issue #${issueNumber}: ${updateRes.status} ${errBody}`)
  }
}
