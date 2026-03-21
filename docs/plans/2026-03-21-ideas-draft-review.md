# Ideas Draft Review & Clearer Modal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `needs-review` draft label to all OpenClaw-generated ideas so the user can review, edit, and publish before they're considered final. Also clarify the Idea vs Project Build tabs in the creation modal.

**Architecture:** Modify the prompts sent to OpenClaw to include a `needs-review` label on every created issue. Extend `listIdeas()` to include `needs-review` issues and expose a `needsReview` boolean on IdeaFile. Add a PATCH endpoint to remove the label (publish). Update the frontend list and detail views with draft indicators and a publish button.

**Tech Stack:** TanStack Router (file-based routes), TanStack Query, GitHub REST API, Tailwind CSS v4

---

### Task 1: Add `needs-review` label to OpenClaw prompts

**Files:**
- Modify: `apps/webclaw/src/routes/api/admin/ideas.submit.ts:60` (buildProjectPrompt)
- Modify: `apps/webclaw/src/routes/api/admin/ideas.submit.ts:187` (buildSeedPrompt)

**Step 1: Update `buildProjectPrompt` label instruction**

In `ideas.submit.ts:60`, change the label instruction from:

```
`2. **Create a GitHub Issue** in \`samgibson-bot/gold-ideas\` with label \`project\`. Do NOT apply \`idea\`, \`seed\`, or any lifecycle labels.`
```

to:

```
`2. **Create a GitHub Issue** in \`samgibson-bot/gold-ideas\` with labels \`project\` and \`needs-review\`. Do NOT apply \`idea\`, \`seed\`, or any lifecycle labels.`
```

**Step 2: Update `buildSeedPrompt` label instruction**

In `ideas.submit.ts:187`, change the label instruction from:

```
**Apply these labels:** \`idea\`, \`seed\`, and any relevant tag labels
```

to:

```
**Apply these labels:** \`idea\`, \`seed\`, \`needs-review\`, and any relevant tag labels
```

**Step 3: Build to verify no errors**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build, no errors

**Step 4: Commit**

```bash
git add apps/webclaw/src/routes/api/admin/ideas.submit.ts
git commit -m "feat: add needs-review label to idea/project prompts"
```

---

### Task 2: Extend `IdeaFile` type and `listIdeas()` to expose draft status

**Files:**
- Modify: `apps/webclaw/src/screens/admin/types.ts:165-174` (IdeaFile type)
- Modify: `apps/webclaw/src/server/github.ts:53-80` (listIdeas function)

**Step 1: Add `needsReview` to IdeaFile type**

In `types.ts`, add `needsReview: boolean` to the `IdeaFile` type:

```typescript
export type IdeaFile = {
  issueNumber: number
  title: string
  tags: Array<string>
  content: string
  created: string
  issueUrl: string
  needsReview: boolean
  prNumber?: number
  prUrl?: string
}
```

**Step 2: Update `listIdeas()` to fetch `needs-review` issues and set `needsReview`**

Currently `listIdeas()` queries `labels=idea&state=all`. Issues with only `project` + `needs-review` (no `idea` label) won't be fetched. Change the approach:

In `github.ts:53-80`, update `listIdeas()`:

```typescript
export async function listIdeas(): Promise<Array<IdeaFromGitHub>> {
  // Fetch both idea-labeled and needs-review-labeled issues
  const [ideaRes, reviewRes] = await Promise.all([
    fetch(
      `${API_BASE}/repos/${OWNER}/${REPO}/issues?labels=idea&state=all&per_page=100`,
      { headers: headers() },
    ),
    fetch(
      `${API_BASE}/repos/${OWNER}/${REPO}/issues?labels=needs-review&state=all&per_page=100`,
      { headers: headers() },
    ),
  ])
  if (!ideaRes.ok) throw new Error(`GitHub API error: ${ideaRes.status}`)
  if (!reviewRes.ok) throw new Error(`GitHub API error: ${reviewRes.status}`)

  const ideaIssues = (await ideaRes.json()) as Array<GitHubIssue>
  const reviewIssues = (await reviewRes.json()) as Array<GitHubIssue>

  // Deduplicate by issue number (ideas with needs-review appear in both)
  const seen = new Set<number>()
  const allIssues: Array<GitHubIssue> = []
  for (const issue of [...ideaIssues, ...reviewIssues]) {
    if (!seen.has(issue.number)) {
      seen.add(issue.number)
      allIssues.push(issue)
    }
  }

  return allIssues.map(function mapIssue(issue) {
    const labelNames = issue.labels.map(function getName(l) {
      return l.name
    })
    const needsReview = labelNames.includes('needs-review')
    const tags = labelNames.filter(function isTag(l) {
      return l !== 'idea' && l !== 'needs-review'
    })

    return {
      issueNumber: issue.number,
      title: issue.title,
      tags,
      content: issue.body ?? '',
      created: issue.created_at,
      issueUrl: issue.html_url,
      needsReview,
      prNumber: issue.pull_request ? issue.number : undefined,
      prUrl: issue.pull_request?.html_url,
    }
  })
}
```

Also update the `IdeaFromGitHub` type to include `needsReview: boolean`.

**Step 3: Build to verify**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build

**Step 4: Commit**

```bash
git add apps/webclaw/src/screens/admin/types.ts apps/webclaw/src/server/github.ts
git commit -m "feat: expose needsReview flag from GitHub needs-review label"
```

---

### Task 3: Add PATCH endpoint to publish (remove `needs-review` label)

**Files:**
- Create: `apps/webclaw/src/routes/api/admin/ideas.publish.ts`

**Step 1: Create the publish route**

Create `apps/webclaw/src/routes/api/admin/ideas.publish.ts`:

```typescript
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
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
```

**Step 2: Build to verify route registers**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build, new route in output

**Step 3: Commit**

```bash
git add apps/webclaw/src/routes/api/admin/ideas.publish.ts
git commit -m "feat: add publish endpoint to remove needs-review label"
```

---

### Task 4: Update creation modal with clearer tab descriptions

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:573-577` (DialogDescription)

**Step 1: Replace the `DialogDescription` with structured descriptions per tab**

Replace lines 573-577 (the single `DialogDescription`) with:

```tsx
<DialogDescription className="sr-only">
  Choose between submitting an idea for research or recording a build project
</DialogDescription>
<div className="mt-2 text-sm text-primary-600 space-y-1">
  {activeTab === 'idea' ? (
    <>
      <p className="text-pretty">
        OpenClaw will research your sources, search for related ideas,
        generate integration pathways, and create a GitHub issue with
        full analysis.
      </p>
      <p className="text-xs text-primary-400">
        Created as draft — you review and publish.
      </p>
    </>
  ) : (
    <>
      <p className="text-pretty">
        Record a build project. OpenClaw writes a short product brief
        and creates a GitHub issue — no research or synergy analysis.
      </p>
      <p className="text-xs text-primary-400">
        Created as draft — you review and publish.
      </p>
    </>
  )}
</div>
```

**Step 2: Build to verify**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build

**Step 3: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx
git commit -m "feat: clearer tab descriptions in create idea modal"
```

---

### Task 5: Add draft badge to idea list rows

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:33-63` (IdeaRow component)

**Step 1: Add a "Draft" badge to IdeaRow when `needsReview` is true**

Update the `IdeaRow` component to show a draft indicator. Add between the title span and the domain tags span:

```tsx
{idea.needsReview ? (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 shrink-0">
    Draft
  </span>
) : null}
```

**Step 2: Build to verify**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build

**Step 3: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx
git commit -m "feat: show Draft badge on needs-review ideas in list"
```

---

### Task 6: Add publish button and edit link to idea detail modal

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:197-258` (IdeaDetail component)

**Step 1: Add publish mutation and UI to IdeaDetail**

Update `IdeaDetail` to accept an `onPublished` callback and show publish/edit controls when `needsReview` is true:

```tsx
function IdeaDetail({
  file,
  onPublished,
}: {
  file: IdeaFile
  onPublished?: () => void
}) {
  const publishMutation = useMutation({
    mutationFn: async function publishIdea() {
      const res = await fetch('/api/admin/ideas/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueNumber: file.issueNumber }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Failed to publish')
    },
    onSuccess: function handlePublished() {
      onPublished?.()
    },
  })
```

Add a draft banner at the top of the detail content (inside the `p-5` div, before the header):

```tsx
{file.needsReview ? (
  <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
    <span className="text-xs text-amber-700 dark:text-amber-300">
      Draft — review before publishing
    </span>
    <div className="flex items-center gap-2 shrink-0">
      <a
        href={`${file.issueUrl}/edit`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] px-2 py-1 rounded border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
      >
        Edit on GitHub
      </a>
      <button
        onClick={function handlePublish() {
          publishMutation.mutate()
        }}
        disabled={publishMutation.isPending}
        className="text-[11px] px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        {publishMutation.isPending ? 'Publishing...' : 'Publish'}
      </button>
    </div>
  </div>
) : null}
```

**Step 2: Pass `onPublished` from IdeasPage**

In `IdeasPage` where `IdeaDetail` is rendered (~line 172), pass the callback:

```tsx
{selected && (
  <IdeaDetail
    file={selected}
    onPublished={function handlePublished() {
      setSelected(null)
      refetch()
    }}
  />
)}
```

**Step 3: Build to verify**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build

**Step 4: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx
git commit -m "feat: publish button and edit link on draft ideas"
```

---

### Task 7: Lint, build, and final commit

**Step 1: Run lint/format**

Run: `pnpm -C apps/webclaw check`

Stage any reformats: `git add -A`

**Step 2: Final build**

Run: `pnpm -C apps/webclaw build`
Expected: Clean build

**Step 3: Commit reformats if any**

```bash
git add -A
git commit -m "style: apply linter formatting"
```

---

### Task 8: Push and create PR

**Step 1: Push**

```bash
git push -u origin feat/ideas-draft-review
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: ideas draft review & clearer modal" --body "$(cat <<'EOF'
## Summary
- Add `needs-review` label to all OpenClaw-generated ideas for draft review before publishing
- Clearer tab descriptions distinguishing Idea (full research) from Project Build (quick brief)
- Draft badge on idea list, publish button + edit link in detail modal
- New `/api/admin/ideas/publish` endpoint to remove `needs-review` label

## Test plan
- [ ] Submit a new idea — verify it appears with "Draft" badge in the list
- [ ] Open the draft — verify yellow banner with "Edit on GitHub" and "Publish" buttons
- [ ] Click "Publish" — verify badge disappears and label removed from GitHub issue
- [ ] Submit a project build — verify same draft flow
- [ ] Verify tab descriptions are clear and distinct

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
