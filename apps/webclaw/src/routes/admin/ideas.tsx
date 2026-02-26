import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { IdeaFile } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/prompt-kit/markdown'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type IdeasResponse = {
  ok: boolean
  error?: string
  ideas?: Array<IdeaFile>
}

const TAG_TYPES = ['product', 'infrastructure', 'research', 'automation'] as const
const TAG_DOMAINS = ['personal', 'finance', 'health', 'social', 'business'] as const
const ALL_TAGS = [...TAG_TYPES, ...TAG_DOMAINS] as const
type IdeaTag = (typeof ALL_TAGS)[number]

export const Route = createFileRoute('/admin/ideas')({
  component: IdeasPage,
})

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

function IdeasPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: adminQueryKeys.ideas,
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
        const group = grouped[type] ?? []
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

// ---------- Idea Detail (Modal Content) ----------

function IdeaDetail({ file }: { file: IdeaFile }) {
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: async function changeStatus(newStatus: string) {
      const res = await fetch('/api/admin/ideas/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueNumber: file.issueNumber,
          status: newStatus,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(
          (data as { error?: string }).error ?? 'Failed to update status',
        )
      }
    },
    onSuccess: function onStatusSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.ideas })
    },
  })

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      <div className="p-5 flex-1 overflow-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <DialogTitle className="text-sm font-medium pr-3">
            {file.title}
          </DialogTitle>
          <div className="flex gap-2 shrink-0 ml-3">
            <a
              href={file.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
            >
              Issue #{file.issueNumber}
            </a>
            {file.prUrl ? (
              <a
                href={file.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-2 py-1 rounded border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900 transition-colors"
              >
                PR #{file.prNumber}
              </a>
            ) : null}
          </div>
        </div>

        {/* Date */}
        {file.created ? (
          <div className="text-xs text-primary-400 mb-3">
            {new Date(file.created).toLocaleDateString()}
          </div>
        ) : null}

        {/* Status pills */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {IDEA_STATUSES.map(function renderStatusPill(s) {
            const isCurrent = file.status === s
            const isUpdating = statusMutation.isPending
            return (
              <button
                key={s}
                disabled={isCurrent || isUpdating}
                onClick={function handleStatusChange() {
                  statusMutation.mutate(s)
                }}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  isCurrent
                    ? cn(
                        STATUS_COLORS[s] ?? STATUS_COLORS.unknown,
                        'ring-1 ring-primary-400 dark:ring-primary-500',
                      )
                    : 'bg-primary-50 text-primary-400 dark:bg-primary-800 dark:text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-700 cursor-pointer',
                  isUpdating && !isCurrent && 'opacity-50 cursor-wait',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>

        {statusMutation.isError ? (
          <div className="text-xs text-red-600 dark:text-red-400 mb-3">
            {statusMutation.error instanceof Error
              ? statusMutation.error.message
              : 'Failed to update status'}
          </div>
        ) : null}

        {/* Tags */}
        {file.tags.length > 0 ? (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {file.tags.map(function renderTag(tag) {
              return (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-600 dark:bg-primary-800 dark:text-primary-300"
                >
                  {tag}
                </span>
              )
            })}
          </div>
        ) : null}

        {/* Related Issues */}
        <RelatedIssueLinks content={file.content} />

        {/* Markdown content */}
        <DialogDescription className="sr-only">
          Idea details and content
        </DialogDescription>
        <div className="text-sm text-primary-800 dark:text-primary-200 prose prose-sm dark:prose-invert max-w-none">
          {file.content ? (
            <Markdown>{file.content}</Markdown>
          ) : (
            <span className="text-primary-400">No content available</span>
          )}
        </div>
      </div>

      {/* Chat input */}
      <IdeaChatInput
        ideaTitle={file.title}
        ideaNumber={file.issueNumber}
        ideaStatus={file.status}
      />
    </div>
  )
}

// ---------- Idea Chat Input ----------

function IdeaChatInput({
  ideaTitle,
  ideaNumber,
  ideaStatus,
}: {
  ideaTitle: string
  ideaNumber: number
  ideaStatus: string
}) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const chatMutation = useMutation({
    mutationFn: async function sendChat(msg: string) {
      const res = await fetch('/api/admin/ideas/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          ideaTitle,
          ideaNumber,
          ideaStatus,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error((data as { error?: string }).error ?? 'Failed to send')
      }
    },
    onSuccess: function onChatSuccess() {
      setMessage('')
      setSent(true)
      setTimeout(function clearSent() {
        setSent(false)
      }, 3000)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || chatMutation.isPending) return
    chatMutation.mutate(message.trim())
  }

  return (
    <div className="border-t border-primary-200 dark:border-primary-700 p-3">
      {sent ? (
        <div className="text-xs text-green-600 dark:text-green-400">
          Sent to ideas session — check chat or Telegram for the response.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={function onMsgChange(e) {
              setMessage(e.target.value)
            }}
            placeholder="Ask OpenClaw about this idea..."
            className="flex-1 text-sm px-3 py-1.5 border border-primary-200 dark:border-primary-600 rounded-md bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
          <button
            type="submit"
            disabled={!message.trim() || chatMutation.isPending}
            className={cn(
              'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
              !message.trim() || chatMutation.isPending
                ? 'bg-primary-200 text-primary-400 dark:bg-primary-700 dark:text-primary-500 cursor-not-allowed'
                : 'bg-primary-800 text-primary-50 dark:bg-primary-200 dark:text-primary-900 hover:bg-primary-700 dark:hover:bg-primary-300',
            )}
          >
            {chatMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </form>
      )}
      {chatMutation.isError ? (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
          {chatMutation.error instanceof Error
            ? chatMutation.error.message
            : 'Failed to send'}
        </div>
      ) : null}
    </div>
  )
}

// ---------- Related Issue Links ----------

function RelatedIssueLinks({ content }: { content: string }) {
  // Parse issue references like #N or full GitHub issue URLs from the body
  const issueRefs = new Set<number>()

  // Match #N patterns (but not inside URLs)
  const hashMatches = content.match(/(?<!\w)#(\d+)/g)
  if (hashMatches) {
    for (const m of hashMatches) {
      const n = parseInt(m.slice(1), 10)
      if (n > 0 && n < 100000) issueRefs.add(n)
    }
  }

  // Match gold-ideas issue URLs
  const urlMatches = content.match(
    /https:\/\/github\.com\/samgibson-bot\/gold-ideas\/issues\/(\d+)/g,
  )
  if (urlMatches) {
    for (const m of urlMatches) {
      const n = parseInt(m.split('/').pop() ?? '0', 10)
      if (n > 0) issueRefs.add(n)
    }
  }

  if (issueRefs.size === 0) return null

  const refs = Array.from(issueRefs).sort(function asc(a, b) {
    return a - b
  })

  return (
    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
        Related Issues
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {refs.map(function renderRef(n) {
          return (
            <a
              key={n}
              href={`https://github.com/samgibson-bot/gold-ideas/issues/${n}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              #{n}
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Create Idea Dialog ----------

type CreateIdeaDialogProps = {
  onClose: () => void
  onCreated: () => void
}

type SubmitResponse = {
  ok: boolean
  error?: string
  sessionKey?: string
  runId?: string
}

function CreateIdeaDialog({ onClose, onCreated }: CreateIdeaDialogProps) {
  const [activeTab, setActiveTab] = useState<'idea' | 'project'>('idea')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<Array<string>>([])

  // Source state (idea tab only)
  const [sourceUrls, setSourceUrls] = useState<Array<string>>([])
  const [screenshotData, setScreenshotData] = useState('')
  const [screenshotName, setScreenshotName] = useState('')

  const hasSource =
    sourceUrls.some(function hasValue(u) {
      return u.trim().length > 0
    }) || screenshotData.length > 0

  function resetForm() {
    setActiveTab('idea')
    setTitle('')
    setDescription('')
    setTagInput('')
    setTags([])
    setSourceUrls([])
    setScreenshotData('')
    setScreenshotName('')
  }

  // Gateway submission mutation (always used)
  const mutation = useMutation({
    mutationFn: async function submitToGateway() {
      const validUrls = sourceUrls.filter(function hasValue(u) {
        return u.trim().length > 0
      })
      const res = await fetch('/api/admin/ideas/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          sources:
            activeTab === 'idea' && validUrls.length > 0
              ? validUrls
              : undefined,
          screenshot:
            activeTab === 'idea' ? screenshotData || undefined : undefined,
          context: description,
          title,
          tags,
        }),
      })
      const data = (await res.json()) as SubmitResponse
      if (!data.ok) throw new Error(data.error ?? 'Failed to submit idea')
      return data
    },
    onSuccess: function handleGatewaySuccess() {
      resetForm()
      onCreated()
    },
  })

  const isPending = mutation.isPending

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Screenshot must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = function onLoad() {
      setScreenshotData(reader.result as string)
      setScreenshotName(file.name)
    }
    reader.readAsDataURL(file)
  }

  function addSourceUrl() {
    setSourceUrls(function append(prev) {
      return [...prev, '']
    })
  }

  function updateSourceUrl(index: number, value: string) {
    setSourceUrls(function update(prev) {
      return prev.map(function maybeUpdate(u, i) {
        return i === index ? value : u
      })
    })
  }

  function removeSourceUrl(index: number) {
    setSourceUrls(function remove(prev) {
      return prev.filter(function notIndex(_u, i) {
        return i !== index
      })
    })
  }

  function addTag(tag: string) {
    const cleaned = tag
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
    if (cleaned && !tags.includes(cleaned)) {
      setTags(function appendTag(prev) {
        return [...prev, cleaned]
      })
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(function filterTag(prev) {
      return prev.filter(function notTag(t) {
        return t !== tag
      })
    })
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(function removeLast(prev) {
        return prev.slice(0, -1)
      })
    }
  }

  const canSubmit = description.trim().length > 0

  return (
    <DialogContent className="w-[min(520px,92vw)]">
      <div className="p-5">
        <DialogTitle>New Idea</DialogTitle>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 p-0.5 bg-primary-100 dark:bg-primary-800 rounded-lg w-fit">
          <button
            type="button"
            onClick={function selectIdea() {
              setActiveTab('idea')
            }}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              activeTab === 'idea'
                ? 'bg-white dark:bg-primary-950 text-primary-900 dark:text-primary-100 shadow-sm'
                : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200',
            )}
          >
            Idea
          </button>
          <button
            type="button"
            onClick={function selectProject() {
              setActiveTab('project')
            }}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              activeTab === 'project'
                ? 'bg-white dark:bg-primary-950 text-primary-900 dark:text-primary-100 shadow-sm'
                : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200',
            )}
          >
            Project Build
          </button>
        </div>

        <DialogDescription className="mt-2">
          {activeTab === 'idea'
            ? 'OpenClaw will analyze your submission, research sources, generate integration pathways, and create a detailed GitHub Issue.'
            : 'Record a personal build project. OpenClaw will write a product brief and create a GitHub Issue — no synergy analysis, no lifecycle automation.'}
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={function handleTitle(e) {
                setTitle(e.target.value)
              }}
              placeholder="Optional — OpenClaw will generate or refine"
              className="w-full px-3 py-2 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1"
              disabled={isPending}
            />
          </div>

          {/* Sources — idea tab only */}
          {activeTab === 'idea' ? (
            <div className="space-y-2">
              {sourceUrls.map(function renderUrlInput(url, index) {
                return (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="url"
                      value={url}
                      onChange={function handleUrl(e) {
                        updateSourceUrl(index, e.target.value)
                      }}
                      placeholder="https://..."
                      className="flex-1 px-3 py-1.5 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1"
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      onClick={function removeUrl() {
                        removeSourceUrl(index)
                      }}
                      className="text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 transition-colors shrink-0 px-1"
                      disabled={isPending}
                      aria-label="Remove URL"
                    >
                      ×
                    </button>
                  </div>
                )
              })}

              {screenshotData ? (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-primary-600 dark:text-primary-400 truncate">
                    {screenshotName}
                  </span>
                  <button
                    type="button"
                    onClick={function removeScreenshot() {
                      setScreenshotData('')
                      setScreenshotName('')
                    }}
                    className="text-[10px] text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 transition-colors shrink-0"
                    disabled={isPending}
                  >
                    ×
                  </button>
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addSourceUrl}
                  className="text-xs text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
                  disabled={isPending}
                >
                  + Add link
                </button>
                {!screenshotData ? (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="screenshot-upload"
                      disabled={isPending}
                    />
                    <label
                      htmlFor="screenshot-upload"
                      className={cn(
                        'text-xs transition-colors',
                        isPending
                          ? 'opacity-50 cursor-not-allowed text-primary-400'
                          : 'cursor-pointer text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200',
                      )}
                    >
                      + Attach screenshot
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">
              Description<span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              value={description}
              onChange={function handleDesc(e) {
                setDescription(e.target.value)
              }}
              placeholder={
                activeTab === 'project'
                  ? 'What is it, who is it for, and what problem does it solve? Include any tech preferences or constraints.'
                  : hasSource
                    ? 'What caught your eye? What should OpenClaw focus on when analyzing this source?'
                    : "Describe the idea in detail. What problem does it solve? What's the vision? Include as much context as you can \u2014 this will be used to generate an expansive roadmap."
              }
              rows={6}
              className="w-full px-3 py-2 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1 resize-none"
              disabled={isPending}
            />
            <p className="text-[11px] text-primary-400 mt-1">
              {activeTab === 'project'
                ? 'OpenClaw will write a product brief with goals, features, technical approach, and first steps.'
                : 'Be expansive — the more context, the better the AI-generated analysis and roadmap.'}
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(function renderTag(tag) {
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={function handleRemove() {
                      removeTag(tag)
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary-200 text-primary-700 dark:bg-primary-700 dark:text-primary-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-300 transition-colors"
                    disabled={isPending}
                  >
                    {tag} ×
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={function handleTagInput(e) {
                setTagInput(e.target.value)
              }}
              onKeyDown={handleTagKeyDown}
              placeholder="Type a tag and press Enter"
              className="w-full px-3 py-1.5 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1"
              disabled={isPending}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {SUGGESTED_TAGS.filter(function notAdded(t) {
                return !tags.includes(t)
              })
                .slice(0, 8)
                .map(function renderSuggestion(tag) {
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={function handleAdd() {
                        addTag(tag)
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-400 hover:bg-primary-200 hover:text-primary-700 dark:hover:bg-primary-700 dark:hover:text-primary-200 transition-colors"
                      disabled={isPending}
                    >
                      + {tag}
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Error */}
          {mutation.isError ? (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Failed to create idea'}
            </div>
          ) : null}

          {/* Success */}
          {mutation.isSuccess ? (
            <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              {activeTab === 'project'
                ? 'Submitted! OpenClaw will write a product brief and create a GitHub Issue.'
                : 'Submitted! OpenClaw will analyze, research, and create a detailed GitHub Issue with integration pathways.'}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <Button
            disabled={!canSubmit || isPending}
            onClick={function handleSubmit() {
              mutation.mutate()
            }}
          >
            {isPending
              ? 'Submitting...'
              : activeTab === 'project'
                ? 'Save Project'
                : 'Submit to OpenClaw'}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
