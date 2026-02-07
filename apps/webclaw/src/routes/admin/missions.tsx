import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import type { IdeaFile } from '@/screens/admin/types'

type MissionsResponse = {
  ok: boolean
  error?: string
  missions?: {
    files?: Array<IdeaFile>
  }
}

export const Route = createFileRoute('/admin/missions')({
  component: MissionsPage,
})

function MissionsPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.missions,
    queryFn: async function fetchMissions() {
      const res = await fetch('/api/admin/missions')
      if (!res.ok) throw new Error('Failed to fetch missions')
      return (await res.json()) as MissionsResponse
    },
  })

  const files = data?.missions?.files ?? []
  const selectedFile = files.find(function findSelected(f) {
    return f.path === selectedPath
  })

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-lg font-medium text-primary-950 mb-4">
        Missions / Ideas
      </h1>

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading missions...</div>
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
                    {file.status ? (
                      <div className="text-xs text-primary-500">
                        {file.status}
                      </div>
                    ) : null}
                    {file.tags && file.tags.length > 0 ? (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {file.tags.map(function renderTag(tag) {
                          return (
                            <span
                              key={tag}
                              className="text-[10px] px-1 py-0.5 rounded bg-primary-100 text-primary-500"
                            >
                              {tag}
                            </span>
                          )
                        })}
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
                <h2 className="text-sm font-medium text-primary-900 mb-2">
                  {selectedFile.title}
                </h2>
                {selectedFile.created ? (
                  <div className="text-xs text-primary-400 mb-3">
                    Created: {selectedFile.created}
                  </div>
                ) : null}
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
