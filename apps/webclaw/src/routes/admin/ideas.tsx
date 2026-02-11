import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

const STATUS_COLORS: Record<string, string> = {
  seed: 'bg-primary-200 text-primary-700',
  elaborating: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-amber-100 text-amber-700',
  validated: 'bg-green-100 text-green-700',
  building: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-primary-100 text-primary-400',
  unknown: 'bg-primary-100 text-primary-500',
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
        <h1 className="text-lg font-medium text-primary-950">
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
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-primary-500">No idea files found</div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] gap-4">
          {/* Sidebar list */}
          <div className="border border-primary-200 rounded-lg overflow-auto">
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
                        ? 'bg-primary-200 text-primary-950'
                        : 'text-primary-700 hover:bg-primary-100',
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          #{file.issueNumber}
                        </span>
                      ) : null}
                      {file.prNumber ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
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
                              className="text-[10px] px-1 py-0.5 rounded bg-primary-100 text-primary-500"
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
          <div className="border border-primary-200 rounded-lg overflow-auto">
            {selectedFile ? (
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-sm font-medium text-primary-900">
                    {selectedFile.title}
                  </h2>
                  <div className="flex gap-2 shrink-0 ml-3">
                    {selectedFile.issueUrl ? (
                      <a
                        href={selectedFile.issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Issue #{selectedFile.issueNumber}
                      </a>
                    ) : null}
                    {selectedFile.githubUrl ? (
                      <a
                        href={selectedFile.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-2 py-1 rounded border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        Branch
                      </a>
                    ) : null}
                    {selectedFile.prUrl ? (
                      <a
                        href={selectedFile.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                      >
                        PR #{selectedFile.prNumber}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {selectedFile.created ? (
                    <span className="text-xs text-primary-400">
                      {selectedFile.created}
                    </span>
                  ) : null}
                  {selectedFile.status ? (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[selectedFile.status] ??
                          STATUS_COLORS.unknown,
                      )}
                    >
                      {selectedFile.status}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-primary-800 whitespace-pre-wrap font-mono text-pretty">
                  {selectedFile.content ?? 'No content available'}
                </div>
              </div>
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

// ---------- Create Idea Dialog ----------

type CreateIdeaDialogProps = {
  onClose: () => void
  onCreated: () => void
}

function CreateIdeaDialog({ onClose, onCreated }: CreateIdeaDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<Array<string>>([])

  const mutation = useMutation({
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

  const canSubmit = title.trim().length > 0 && description.trim().length > 0

  return (
    <DialogContent className="w-[min(520px,92vw)]">
      <div className="p-5">
        <DialogTitle>New Idea</DialogTitle>
        <DialogDescription className="mt-1">
          Submit a new idea. It will create a GitHub Issue and an idea file in the repository.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-primary-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={function handleTitle(e) {
                setTitle(e.target.value)
              }}
              placeholder="A concise name for the idea"
              className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 focus:ring-offset-1"
              disabled={mutation.isPending}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-primary-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={function handleDesc(e) {
                setDescription(e.target.value)
              }}
              placeholder="Describe the idea in detail. What problem does it solve? What's the vision? Include as much context as you can — this will be used to generate an expansive roadmap."
              rows={6}
              className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 focus:ring-offset-1 resize-none"
              disabled={mutation.isPending}
            />
            <p className="text-[11px] text-primary-400 mt-1">
              Be expansive — the more context, the better the generated roadmap (5-10 points).
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-primary-700 mb-1">
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
                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary-200 text-primary-700 hover:bg-red-100 hover:text-red-600 transition-colors"
                    disabled={mutation.isPending}
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
              className="w-full px-3 py-1.5 text-sm border border-primary-200 rounded-lg bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-950 focus:ring-offset-1"
              disabled={mutation.isPending}
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
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-500 hover:bg-primary-200 hover:text-primary-700 transition-colors"
                      disabled={mutation.isPending}
                    >
                      + {tag}
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Error */}
          {mutation.isError ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Failed to create idea'}
            </div>
          ) : null}

          {/* Success */}
          {mutation.isSuccess && mutation.data ? (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Created!{' '}
              <a
                href={mutation.data.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Issue #{mutation.data.issueNumber}
              </a>{' '}
              and file <code className="text-xs">{mutation.data.filePath}</code>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <Button
            disabled={!canSubmit || mutation.isPending}
            onClick={function handleSubmit() {
              mutation.mutate()
            }}
          >
            {mutation.isPending ? 'Creating...' : 'Create Idea'}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
