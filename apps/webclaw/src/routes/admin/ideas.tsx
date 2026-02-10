import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import type { IdeaFile } from '@/screens/admin/types'

type IdeasResponse = {
  ok: boolean
  error?: string
  ideas?: {
    files?: Array<IdeaFile>
  }
}

const STATUS_COLORS: Record<string, string> = {
  seed: 'bg-primary-200 text-primary-700',
  elaborating: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-amber-100 text-amber-700',
  validated: 'bg-green-100 text-green-700',
  building: 'bg-purple-100 text-purple-700',
  unknown: 'bg-primary-100 text-primary-500',
}

export const Route = createFileRoute('/admin/ideas')({
  component: IdeasPage,
})

function IdeasPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

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
      <h1 className="text-lg font-medium text-primary-950 mb-4">
        Ideas
      </h1>

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

          <div className="border border-primary-200 rounded-lg overflow-auto">
            {selectedFile ? (
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-sm font-medium text-primary-900">
                    {selectedFile.title}
                  </h2>
                  <div className="flex gap-2 shrink-0 ml-3">
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
