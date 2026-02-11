import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/prompt-kit/markdown'
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import type { IdeaFile } from '@/screens/admin/types'

type IdeasResponse = {
  ok: boolean
  error?: string
  ideas?: {
    files?: Array<IdeaFile>
  }
}

type CreateIdeaResponse = {
  ok: boolean
  error?: string
  result?: {
    issueNumber: number
    issueUrl: string
    filePath: string
    slug: string
  }
}

const IDEA_STATUSES = [
  'seed',
  'elaborating',
  'reviewing',
  'validated',
  'building',
  'completed',
  'archived',
] as const

const STATUS_COLORS: Record<string, string> = {
  seed: 'bg-primary-200 text-primary-700 dark:bg-primary-700 dark:text-primary-200',
  elaborating: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  reviewing: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  validated: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  building: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  archived: 'bg-primary-100 text-primary-400 dark:bg-primary-800 dark:text-primary-400',
  unknown: 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-400',
}

const SUGGESTED_TAGS = [
  'automation',
  'agents',
  'infrastructure',
  'research',
  'product',
  'tooling',
  'ai',
  'web',
  'mobile',
  'data',
]

export const Route = createFileRoute('/admin/ideas')({
  component: IdeasPage,
})

function IdeasPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.ideas,
    queryFn: async function fetchIdeas() {
      const res = await fetch('/api/admin/ideas')
      if (!res.ok) throw new Error('Failed to fetch ideas')
      return (await res.json()) as IdeasResponse
    },
    refetchInterval: 60_000,
  })

  const files = data?.ideas?.files ?? []
  const selectedFile = files.find(function findSelected(f) {
    return f.path === selectedPath
  })

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-primary-950 dark:text-primary-50">
          Ideas
        </h1>
        <DialogRoot open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="mr-1"
                >
                  <path
                    d="M7 1v12M1 7h12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                New Idea
              </Button>
            }
          />
          <CreateIdeaDialog
            onClose={function handleClose() {
              setDialogOpen(false)
            }}
            onCreated={function handleCreated() {
              setDialogOpen(false)
              queryClient.invalidateQueries({ queryKey: adminQueryKeys.ideas })
            }}
          />
        </DialogRoot>
      </div>

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading ideas...</div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-primary-500">No idea files found</div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] gap-4">
          {/* Sidebar list */}
          <div className="border border-primary-200 dark:border-primary-700 rounded-lg overflow-auto">
            <div className="p-2 space-y-0.5">
              {files.map(function renderFile(file) {
                const isActive = file.path === selectedPath
                return (
                  <button
                    key={file.path}
                    onClick={function handleSelect() {
                      setSelectedPath(isActive ? null : file.path)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-primary-200 text-primary-950 dark:bg-primary-700 dark:text-primary-50'
                        : 'text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800',
                    )}
                  >
                    <div className="font-medium truncate">{file.title}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {file.status ? (
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            STATUS_COLORS[file.status] ??
                              STATUS_COLORS.unknown,
                          )}
                        >
                          {file.status}
                        </span>
                      ) : null}
                      {file.issueNumber ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-medium">
                          #{file.issueNumber}
                        </span>
                      ) : null}
                      {file.prNumber ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 font-medium">
                          PR #{file.prNumber}
                        </span>
                      ) : null}
                    </div>
                    {file.tags && file.tags.length > 0 ? (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {file.tags.slice(0, 4).map(function renderTag(tag) {
                          return (
                            <span
                              key={tag}
                              className="text-[10px] px-1 py-0.5 rounded bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-400"
                            >
                              {tag}
                            </span>
                          )
                        })}
                        {file.tags.length > 4 ? (
                          <span className="text-[10px] px-1 py-0.5 text-primary-400">
                            +{file.tags.length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="border border-primary-200 dark:border-primary-700 rounded-lg overflow-auto flex flex-col">
            {selectedFile ? (
              <IdeaDetail file={selectedFile} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-primary-400">
                Select an idea to view
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Idea Detail Panel ----------

function IdeaDetail({ file }: { file: IdeaFile }) {
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: async function changeStatus(newStatus: string) {
      const res = await fetch('/api/admin/ideas/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path, status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error((data as { error?: string }).error ?? 'Failed to update status')
      }
    },
    onSuccess: function onStatusSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.ideas })
    },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex-1 overflow-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-sm font-medium text-primary-900 dark:text-primary-100">
            {file.title}
          </h2>
          <div className="flex gap-2 shrink-0 ml-3">
            {file.issueUrl ? (
              <a
                href={file.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
              >
                Issue #{file.issueNumber}
              </a>
            ) : null}
            {file.githubUrl ? (
              <a
                href={file.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] px-2 py-1 rounded border border-primary-200 dark:border-primary-600 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-800 transition-colors inline-flex items-center gap-1"
              >
                View on GitHub
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : null}
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
            {file.created}
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
                    ? cn(STATUS_COLORS[s] ?? STATUS_COLORS.unknown, 'ring-1 ring-primary-400 dark:ring-primary-500')
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

        {/* Markdown content */}
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
        ideaPath={file.path}
        ideaStatus={file.status ?? ''}
      />
    </div>
  )
}

// ---------- Idea Chat Input ----------

function IdeaChatInput({
  ideaTitle,
  ideaPath,
  ideaStatus,
}: {
  ideaTitle: string
  ideaPath: string
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
          ideaPath,
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
            className="flex-1 text-sm px-3 py-1.5 border border-primary-200 dark:border-primary-600 rounded-md bg-surface text-primary-900 dark:text-primary-100 placeholder:text-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<Array<string>>([])

  // Source state
  const [showSource, setShowSource] = useState(false)
  const [sourceType, setSourceType] = useState<'url' | 'screenshot'>('url')
  const [sourceUrl, setSourceUrl] = useState('')
  const [screenshotData, setScreenshotData] = useState('')
  const [screenshotName, setScreenshotName] = useState('')

  const hasSource =
    showSource &&
    ((sourceType === 'url' && sourceUrl.trim().length > 0) ||
      (sourceType === 'screenshot' && screenshotData.length > 0))

  // Static creation mutation (no source)
  const staticMutation = useMutation({
    mutationFn: async function submitIdea() {
      const res = await fetch('/api/admin/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, tags }),
      })
      const data = (await res.json()) as CreateIdeaResponse
      if (!data.ok) throw new Error(data.error ?? 'Failed to create idea')
      return data.result!
    },
    onSuccess: function handleSuccess() {
      onCreated()
    },
  })

  // Gateway submission mutation (with source)
  const gatewayMutation = useMutation({
    mutationFn: async function submitWithSource() {
      const source =
        sourceType === 'url' ? sourceUrl.trim() : screenshotData
      const res = await fetch('/api/admin/ideas/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          sourceType,
          context: description,
          title,
          tags,
        }),
      })
      const data = (await res.json()) as SubmitResponse
      if (!data.ok) throw new Error(data.error ?? 'Failed to submit idea')
      return data
    },
  })

  const mutation = hasSource ? gatewayMutation : staticMutation
  const isPending = staticMutation.isPending || gatewayMutation.isPending

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

  function addTag(tag: string) {
    const cleaned = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
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

  const canSubmit = (hasSource || title.trim().length > 0) && description.trim().length > 0

  return (
    <DialogContent className="w-[min(520px,92vw)]">
      <div className="p-5">
        <DialogTitle>New Idea</DialogTitle>
        <DialogDescription className="mt-1">
          Submit a new idea.{' '}
          {hasSource
            ? 'OpenClaw will research your source and create a detailed Issue.'
            : 'It will create a GitHub Issue and an idea file in the repository.'}
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
              placeholder={hasSource ? "Optional — OpenClaw will generate one" : "A concise name for the idea"}
              className="w-full px-3 py-2 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 dark:text-primary-100 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1"
              disabled={isPending}
            />
          </div>

          {/* Source (collapsible) */}
          <div>
            {!showSource ? (
              <button
                type="button"
                onClick={function toggleSource() {
                  setShowSource(true)
                }}
                className="text-xs text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
                disabled={isPending}
              >
                + Add a source (URL or screenshot)
              </button>
            ) : (
              <div className="border border-primary-200 dark:border-primary-700 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    Source
                  </label>
                  <button
                    type="button"
                    onClick={function hideSource() {
                      setShowSource(false)
                      setSourceUrl('')
                      setScreenshotData('')
                      setScreenshotName('')
                    }}
                    className="text-[10px] text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 transition-colors"
                    disabled={isPending}
                  >
                    Remove
                  </button>
                </div>

                {/* URL / Screenshot toggle */}
                <div className="flex gap-1 p-0.5 rounded-md bg-primary-100 dark:bg-primary-800 w-fit">
                  <button
                    type="button"
                    onClick={function selectUrl() {
                      setSourceType('url')
                    }}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded font-medium transition-colors',
                      sourceType === 'url'
                        ? 'bg-white dark:bg-primary-600 text-primary-900 dark:text-primary-100 shadow-sm'
                        : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200',
                    )}
                    disabled={isPending}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={function selectScreenshot() {
                      setSourceType('screenshot')
                    }}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded font-medium transition-colors',
                      sourceType === 'screenshot'
                        ? 'bg-white dark:bg-primary-600 text-primary-900 dark:text-primary-100 shadow-sm'
                        : 'text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200',
                    )}
                    disabled={isPending}
                  >
                    Screenshot
                  </button>
                </div>

                {sourceType === 'url' ? (
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={function handleUrl(e) {
                      setSourceUrl(e.target.value)
                    }}
                    placeholder="https://twitter.com/... or any URL"
                    className="w-full px-3 py-1.5 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 dark:text-primary-100 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1"
                    disabled={isPending}
                  />
                ) : (
                  <div>
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
                        'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-primary-200 dark:border-primary-600 transition-colors',
                        isPending
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-800',
                        'text-primary-700 dark:text-primary-300',
                      )}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {screenshotName || 'Upload screenshot'}
                    </label>
                    {screenshotData ? (
                      <span className="ml-2 text-[10px] text-green-600 dark:text-green-400">
                        Attached
                      </span>
                    ) : null}
                  </div>
                )}

                <p className="text-[10px] text-primary-400">
                  Adding a source routes through OpenClaw for AI-powered research and analysis.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">
              {hasSource ? 'Context' : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={function handleDesc(e) {
                setDescription(e.target.value)
              }}
              placeholder={
                hasSource
                  ? 'What caught your eye? What should OpenClaw focus on when analyzing this source?'
                  : 'Describe the idea in detail. What problem does it solve? What\'s the vision? Include as much context as you can \u2014 this will be used to generate an expansive roadmap.'
              }
              rows={hasSource ? 4 : 6}
              className="w-full px-3 py-2 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 dark:text-primary-100 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1 resize-none"
              disabled={isPending}
            />
            {!hasSource ? (
              <p className="text-[11px] text-primary-400 mt-1">
                Be expansive — the more context, the better the generated roadmap (5-10 points).
              </p>
            ) : null}
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
              className="w-full px-3 py-1.5 text-sm border border-primary-200 dark:border-primary-600 rounded-lg bg-surface text-primary-900 dark:text-primary-100 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 dark:focus:ring-primary-400 focus:ring-offset-1"
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

          {/* Success — static */}
          {staticMutation.isSuccess && staticMutation.data ? (
            <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              Created!{' '}
              <a
                href={staticMutation.data.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Issue #{staticMutation.data.issueNumber}
              </a>{' '}
              and file <code className="text-xs">{staticMutation.data.filePath}</code>
            </div>
          ) : null}

          {/* Success — gateway */}
          {gatewayMutation.isSuccess ? (
            <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              Sent to ideas session — OpenClaw will research and create an Issue.
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <Button
            disabled={!canSubmit || isPending}
            onClick={function handleSubmit() {
              if (hasSource) {
                gatewayMutation.mutate()
              } else {
                staticMutation.mutate()
              }
            }}
          >
            {isPending
              ? hasSource
                ? 'Submitting...'
                : 'Creating...'
              : hasSource
                ? 'Submit to OpenClaw'
                : 'Create Idea'}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
