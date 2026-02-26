# Ideas System Simplification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the gold-ideas pipeline — fixed tag taxonomy, open/closed status only, list view instead of kanban, remove idea-lifecycle cron, and convert weekly synergy audit from new-issue-per-week to a rolling pinned issue with targeted comments.

**Architecture:** Dashboard changes live in `apps/webclaw/src/routes/admin/ideas.tsx` (1019 lines) plus supporting server files. VPS changes are SSH operations against the OpenClaw workspace scripts and knowledge files. The synergy audit script lives only on the VPS.

**Tech Stack:** TanStack Router, React, Tailwind CSS v4, GitHub REST API, bash + OpenRouter direct API (VPS scripts)

---

## Task 1: Update tag constants — replace free-form with fixed taxonomy

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:24-95`

**Step 1: Replace SUGGESTED_TAGS and remove status constants**

In `apps/webclaw/src/routes/admin/ideas.tsx`, replace lines 24-95 (IDEA_STATUSES, STATUS_COLORS, COLUMN_CONFIG, SUGGESTED_TAGS) with:

```typescript
const TAG_TYPES = ['product', 'infrastructure', 'research', 'automation'] as const
const TAG_DOMAINS = ['personal', 'finance', 'health', 'social', 'business'] as const
const ALL_TAGS = [...TAG_TYPES, ...TAG_DOMAINS] as const
type IdeaTag = (typeof ALL_TAGS)[number]
```

Leave any other imports/code below line 95 untouched for now.

**Step 2: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx
git commit -m "refactor: replace free-form tags with fixed two-tier taxonomy"
```

---

## Task 2: Replace kanban with grouped list view

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:101-312`

**Step 1: Rewrite IdeasPage**

Replace the entire `IdeasPage` function (lines 101-312 — the kanban grid) with a grouped list. Key logic:

```typescript
function IdeasPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.ideas,
    queryFn: async function fetchIdeas() {
      const res = await fetch('/api/admin/ideas')
      const json = await res.json()
      if (!json.ok) throw new Error('Failed to fetch ideas')
      return json.ideas as Array<IdeaFile>
    },
    refetchInterval: 60_000,
  })

  const [selected, setSelected] = useState<IdeaFile | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const ideas = data ?? []

  // Group by type tag
  const grouped = TAG_TYPES.reduce<Partial<Record<string, Array<IdeaFile>>>>(
    function buildGroups(acc, type) {
      acc[type] = ideas.filter((idea) => idea.tags.includes(type))
      return acc
    },
    {},
  )
  const ungrouped = ideas.filter(
    (idea) => !TAG_TYPES.some((t) => idea.tags.includes(t)),
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-primary-900 dark:text-primary-100 text-balance">
            Ideas
          </h1>
          <p className="text-sm text-primary-500 tabular-nums">
            {ideas.length} open
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-800 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-primary-900 dark:bg-primary-100 text-primary-50 dark:text-primary-900 hover:opacity-90 transition-opacity"
          >
            New Idea
          </button>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-primary-500">Loading...</p>
      )}
      {error && (
        <p className="text-sm text-red-500">Failed to load ideas</p>
      )}

      {TAG_TYPES.map(function renderTypeGroup(type) {
        const group = (grouped[type] ?? []) as Array<IdeaFile>
        if (group.length === 0) return null
        return (
          <section key={type}>
            <h2 className="text-xs font-medium text-primary-400 uppercase tracking-wide mb-2">
              {type}
            </h2>
            <div className="space-y-0.5">
              {group.map((idea) => (
                <IdeaRow
                  key={idea.issueNumber}
                  idea={idea}
                  onClick={() => setSelected(idea)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {ungrouped.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-primary-400 uppercase tracking-wide mb-2">
            Other
          </h2>
          <div className="space-y-0.5">
            {ungrouped.map((idea) => (
              <IdeaRow
                key={idea.issueNumber}
                idea={idea}
                onClick={() => setSelected(idea)}
              />
            ))}
          </div>
        </section>
      )}

      {selected && (
        <IdeaDetail file={selected} onClose={() => setSelected(null)} />
      )}
      {showCreate && <CreateIdeaDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
```

**Step 2: Add IdeaRow component** (insert before IdeasPage or after it):

```typescript
function IdeaRow({ idea, onClick }: { idea: IdeaFile; onClick: () => void }) {
  const domainTags = idea.tags.filter((t): t is IdeaTag =>
    TAG_DOMAINS.includes(t as IdeaTag),
  )

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-primary-50 dark:hover:bg-primary-800 transition-colors group"
    >
      <span className="flex-1 text-sm text-primary-900 dark:text-primary-100 truncate text-pretty">
        {idea.title}
      </span>
      <span className="flex items-center gap-1 shrink-0">
        {domainTags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-400"
          >
            {tag}
          </span>
        ))}
      </span>
      <span className="text-xs text-primary-400 tabular-nums shrink-0">
        #{idea.issueNumber}
      </span>
      <span className="text-xs text-primary-400 tabular-nums shrink-0">
        {new Date(idea.created).toLocaleDateString()}
      </span>
    </button>
  )
}
```

**Step 3: Run lint**

```bash
pnpm -C apps/webclaw lint
```

Fix any errors (unused COLUMN_CONFIG, STATUS_COLORS references).

**Step 4: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx
git commit -m "feat: replace ideas kanban with grouped list view"
```

---

## Task 3: Remove status selector from IdeaDetail

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:316-455`
- Modify: `apps/webclaw/src/routes/api/admin/ideas.chat.ts`

**Step 1: In IdeaDetail, delete statusMutation and the status pill row**

- Delete the `useMutation` block for status updates (the `statusMutation` variable and its options)
- Delete the `<div className="flex items-center gap-1 mb-4 flex-wrap">` block containing the status pill buttons (lines ~379-405)
- Remove `ideaStatus` prop from `IdeaChatInput` call if it exists

**Step 2: Update IdeaChatInput to not pass ideaStatus**

In the `IdeaChatInput` usage, remove the `ideaStatus` prop. In `apps/webclaw/src/routes/api/admin/ideas.chat.ts`, remove `ideaStatus` from the request body and update the context prefix:

Change from:
```typescript
const prefixed = `Re: "${ideaTitle}" (issue #${ideaNumber}) (status: ${ideaStatus})\n\n${message}`
```
To:
```typescript
const prefixed = `Re: "${ideaTitle}" (issue #${ideaNumber})\n\n${message}`
```

**Step 3: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx apps/webclaw/src/routes/api/admin/ideas.chat.ts
git commit -m "feat: remove status selector from idea detail"
```

---

## Task 4: Replace tag input with button groups in CreateIdeaDialog

**Files:**
- Modify: `apps/webclaw/src/routes/admin/ideas.tsx:615-1018`

**Step 1: Replace tag state and handlers**

Inside `CreateIdeaDialog`, delete:
- `tagInput` state
- `addTag()` function
- `removeTag()` function
- `handleTagKeyDown()` function

Add:
```typescript
const [selectedTags, setSelectedTags] = useState<Array<IdeaTag>>([])

function toggleTag(tag: IdeaTag) {
  setSelectedTags((prev) =>
    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
  )
}
```

**Step 2: Replace tag rendering section (~lines 929-977) with button groups**

```typescript
<div className="space-y-3">
  <div>
    <p className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-2">
      Type
    </p>
    <div className="flex gap-1.5 flex-wrap">
      {TAG_TYPES.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggleTag(tag)}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            selectedTags.includes(tag)
              ? 'bg-primary-900 text-primary-50 border-primary-900 dark:bg-primary-100 dark:text-primary-900 dark:border-primary-100'
              : 'bg-transparent text-primary-500 border-primary-200 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-500',
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  </div>
  <div>
    <p className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-2">
      Domain
    </p>
    <div className="flex gap-1.5 flex-wrap">
      {TAG_DOMAINS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggleTag(tag)}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            selectedTags.includes(tag)
              ? 'bg-primary-900 text-primary-50 border-primary-900 dark:bg-primary-100 dark:text-primary-900 dark:border-primary-100'
              : 'bg-transparent text-primary-500 border-primary-200 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-500',
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  </div>
</div>
```

**Step 3: Update submit handler**

Replace all references to the old `tags` array state with `selectedTags` in the submit/mutation call.

**Step 4: Run lint**

```bash
pnpm -C apps/webclaw lint
```

Fix unused imports (old tag input handler imports if any).

**Step 5: Commit**

```bash
git add apps/webclaw/src/routes/admin/ideas.tsx
git commit -m "feat: tag picker becomes two button groups (type + domain)"
```

---

## Task 5: Remove status from server-side github.ts and types

**Files:**
- Modify: `apps/webclaw/src/server/github.ts`
- Modify: `apps/webclaw/src/screens/admin/types.ts:165-175`
- Delete: `apps/webclaw/src/routes/api/admin/ideas.status.ts`

**Step 1: Update IdeaFile type — remove status field**

In `apps/webclaw/src/screens/admin/types.ts`, remove `status: string` from `IdeaFile`.

**Step 2: Clean up github.ts**

In `apps/webclaw/src/server/github.ts`:
- Delete the `STATUS_LABELS` array (lines 52-60)
- Delete the `updateIdeaStatus()` function (lines 334-382)
- In `listIdeas()`, remove status extraction from labels. Tags are now all non-`idea` labels
- In `createIdea()`, change initial labels from `['idea', 'seed', ...tags]` to `['idea', ...tags]`

**Step 3: Delete the status API route file**

```bash
rm apps/webclaw/src/routes/api/admin/ideas.status.ts
```

**Step 4: Run build to catch TypeScript errors**

```bash
pnpm -C apps/webclaw build
```

Fix any errors from removed `status` field on `IdeaFile` (likely in the ideas route referencing `file.status`).

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove status field — open/closed only, simplify github.ts"
```

---

## Task 6: Create PR and deploy

**Step 1: Push and create PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: ideas system simplification — tags, list view, no status" --body "$(cat <<'EOF'
## Summary
- Fixed two-tier tag taxonomy (type: product/infrastructure/research/automation, domain: personal/finance/health/social/business)
- Replaced kanban with grouped list view
- Dropped 7-stage status pipeline — open/closed only
- Removed status API route and server functions
- Tag picker is now two button groups, no free-form input

## Test plan
- [ ] New idea dialog shows two button groups (Type + Domain)
- [ ] Ideas page shows grouped list by type tag
- [ ] Ideas with no type tag appear under "Other"
- [ ] Detail modal has no status selector
- [ ] Lint and build pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 2: Merge and verify deploy**

After merge, verify the GitHub Action deploys successfully. Check the live dashboard at the production URL.

---

## Task 7: Delete idea-lifecycle cron job and script from VPS

> Do this AFTER the dashboard PR is merged (no dependency, but cleaner sequencing).

**Step 1: Delete the cron job**

The idea-lifecycle job ID is `88adcaf9-8ab8-40d3-b8bc-b88df9e59d36`. Use the dashboard UI at `/admin/cron` to delete it, or via gateway RPC:

```bash
ssh claw@100.77.85.46 "source ~/.nvm/nvm.sh && openclaw rpc cron.delete '{\"jobId\":\"88adcaf9-8ab8-40d3-b8bc-b88df9e59d36\"}'"
```

Verify it's gone:
```bash
ssh claw@100.77.85.46 "curl -s http://localhost:3000/api/admin/cron | python3 -c \"import sys,json; [print(j['name']) for j in json.load(sys.stdin)['cron']['jobs']]\""
```

**Step 2: Delete the script**

```bash
ssh claw@100.77.85.46 "rm ~/.openclaw/workspace/scripts/idea-lifecycle.sh"
```

---

## Task 8: Update OpenClaw workspace knowledge files on VPS

**Files on VPS:**
- `~/.openclaw/workspace/TOOLS.md`
- `~/.openclaw/workspace/SOUL.md`
- `~/.openclaw/workspace/MEMORY.md`
- `~/.openclaw/workspace/gold-ideas/README.md`

**Step 1: Update TOOLS.md**

SSH in, find the "Status Labels" section (lines ~146-152) and replace it:

```
### Status Labels
- `seed` — Initial capture
- `elaborating` — Research in progress
- `reviewing` — Under review
- `validated` — Approved/ready
- `building` — Active implementation
- `completed` — Finished
```

Replace with:

```
### Status
- Open issue = active idea
- Closed issue = done or archived

### Tag Taxonomy
- **Type** (pick one): `product` | `infrastructure` | `research` | `automation`
- **Domain** (optional): `personal` | `finance` | `health` | `social` | `business`
```

Also update the workflow line (~141): change `labels (idea + status + tags)` → `labels (idea + type-tag + domain-tags)`.

**Step 2: Update SOUL.md**

Remove the model routing rows for `elaborating` and `reviewing` from the lifecycle stage table (~lines 162-163). The `idea-lifecycle` cron that used those routes is deleted.

**Step 3: Update MEMORY.md**

Find the Status Labels line (~line 13) and replace:

```
- **Status Labels**: `seed`, `elaborating`, `reviewing`, `validated`, `building`, `completed`, `archived`.
```

With:

```
- **Status**: Open = active idea. Closed = done/archived. No status labels.
- **Tags**: Type (product|infrastructure|research|automation) + Domain (personal|finance|health|social|business).
```

**Step 4: Update gold-ideas/README.md**

Find the status line (~line 61):
```
status: seed | elaborating | validated | building | completed | archived
```
Replace with:
```
status: open (active) | closed (done or archived)
```

**Step 5: Commit workspace changes on VPS**

```bash
ssh claw@100.77.85.46 "cd ~/.openclaw/workspace && git add -A && git commit -m 'chore: remove idea-lifecycle, update to open/closed status + fixed tag taxonomy'"
```

---

## Task 9: Rewrite weekly-synergy-audit.sh on VPS

**File:** `~/.openclaw/workspace/scripts/weekly-synergy-audit.sh`

**Step 1: Read the current script first**

```bash
ssh claw@100.77.85.46 "cat ~/.openclaw/workspace/scripts/weekly-synergy-audit.sh"
```

**Step 2: Rewrite the script**

Key changes from current:
1. Find or create the rolling pinned audit issue (instead of creating a new one each time)
2. Post a comment on it (instead of creating a new issue)
3. After posting, identify and post up to 2 targeted comments on specific ideas
4. Use `<!-- synergy-YYYY-WW -->` sentinel to prevent duplicate weekly runs

Write the new script via SSH heredoc. The new script must:

```bash
# Find or create rolling audit issue with label "audit"
# If not found: gh issue create + pin it
# Check if sentinel comment already exists this week → exit if so
# Fetch open ideas (with labels, createdAt, updatedAt)
# Compute stale ideas (no update >14 days) in bash using updatedAt
# Call LLM with full context — prompt includes tag taxonomy, stale ideas, open/closed lists
# Comment structure: Synergies / Overlaps / Unblocked / Stale flags / Bold call
# Post comment on rolling issue
# Ask LLM to identify up to 2 targeted issues from the audit
# For each target: check sentinel, post targeted comment linking back to audit issue
# Max 2 targeted comments per run
```

**Step 3: Make executable and test dry-run**

```bash
ssh claw@100.77.85.46 "chmod +x ~/.openclaw/workspace/scripts/weekly-synergy-audit.sh"
# Dry-run by checking it parses correctly (bash -n):
ssh claw@100.77.85.46 "bash -n ~/.openclaw/workspace/scripts/weekly-synergy-audit.sh && echo 'syntax ok'"
```

**Step 4: Commit the updated script on VPS**

```bash
ssh claw@100.77.85.46 "cd ~/.openclaw/workspace && git add scripts/weekly-synergy-audit.sh && git commit -m 'feat: synergy audit — rolling issue + targeted comments, max 2/run'"
```

---

## Task 10: Delete GitHub kanban

**Step 1: Delete the GitHub Project board**

Go to `https://github.com/users/samgibson-bot/projects` and delete the gold-ideas kanban project. Or via GitHub CLI:

```bash
# List projects to find the ID
gh api graphql -f query='{ user(login: "samgibson-bot") { projectsV2(first: 10) { nodes { id title } } } }'
# Delete the project (replace PROJECT_ID with the actual ID)
gh api graphql -f query='mutation { deleteProjectV2(input: { projectId: "PROJECT_ID" }) { clientMutationId } }'
```

**Step 2: Verify**

Check `https://github.com/samgibson-bot/gold-ideas` — the Projects tab should show no linked project.
