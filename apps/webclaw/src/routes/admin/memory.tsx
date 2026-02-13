import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'

type WorkspaceResponse = {
  ok: boolean
  error?: string
  workspace?: {
    soul: string | null
    memory: string | null
    agents: string | null
  }
}

type DirEntry = {
  name: string
  path: string
  type: string
  modified?: string
}

type DirResponse = {
  ok: boolean
  entries?: Array<DirEntry>
  path?: string
}

type FileResponse = {
  ok: boolean
  content?: string
}

const WORKSPACE_FILES = ['SOUL.md', 'MEMORY.md', 'AGENTS.md'] as const
const SHARED_CONTEXT_DIRS = [
  'agent-outputs',
  'feedback',
  'roundtable',
  'decisions',
  'kpis',
  'content-calendar',
] as const

export const Route = createFileRoute('/admin/memory')({
  component: MemoryPage,
})

function MemoryPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'workspace' | 'shared-context'>(
    'workspace',
  )
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [activeDir, setActiveDir] = useState<string | null>(null)
  const [editingPriorities, setEditingPriorities] = useState(false)
  const [prioritiesText, setPrioritiesText] = useState('')

  const workspaceQuery = useQuery({
    queryKey: adminQueryKeys.memory,
    queryFn: async function fetchWorkspace() {
      const res = await fetch('/api/admin/memory?section=workspace')
      if (!res.ok) throw new Error('Failed to fetch workspace')
      return (await res.json()) as WorkspaceResponse
    },
    enabled: activeTab === 'workspace',
  })

  const dirQuery = useQuery({
    queryKey: ['admin', 'memory', 'dir', activeDir],
    queryFn: async function fetchDir() {
      const url = activeDir
        ? `/api/admin/memory?section=shared-context&dir=${encodeURIComponent(activeDir)}`
        : '/api/admin/memory?section=shared-context'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch directory')
      return (await res.json()) as DirResponse
    },
    enabled: activeTab === 'shared-context',
  })

  const prioritiesMutation = useMutation({
    mutationFn: async function updatePriorities(content: string) {
      const res = await fetch('/api/admin/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_priorities', content }),
      })
      if (!res.ok) throw new Error('Failed to update priorities')
      return res.json()
    },
    onSuccess: function onSuccess() {
      setEditingPriorities(false)
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.memory })
    },
  })

  async function loadFile(path: string) {
    setSelectedFile(path)
    try {
      const res = await fetch(
        `/api/admin/memory?section=file&path=${encodeURIComponent(path)}`,
      )
      const data = (await res.json()) as FileResponse
      setFileContent(data.content ?? '')
    } catch {
      setFileContent('Failed to load file')
    }
  }

  const workspace = workspaceQuery.data?.workspace

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-medium text-primary-950">
          Memory & Shared-Context
        </h1>
        <p className="text-sm text-primary-600 mt-1">
          Workspace files and cross-agent shared context
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary-200">
        <button
          onClick={function handleWorkspace() {
            setActiveTab('workspace')
          }}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'workspace'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-primary-600 hover:text-primary-900',
          )}
        >
          Workspace
        </button>
        <button
          onClick={function handleSharedContext() {
            setActiveTab('shared-context')
          }}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'shared-context'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-primary-600 hover:text-primary-900',
          )}
        >
          Shared-Context
        </button>
      </div>

      {/* Workspace Tab */}
      {activeTab === 'workspace' ? (
        <div className="space-y-4">
          {workspaceQuery.isLoading ? (
            <div className="text-sm text-primary-500">
              Loading workspace...
            </div>
          ) : workspaceQuery.error ? (
            <div className="text-sm text-red-600">
              {workspaceQuery.error instanceof Error
                ? workspaceQuery.error.message
                : 'Failed to load'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {WORKSPACE_FILES.map(function renderFile(name) {
                const key = name.replace('.md', '').toLowerCase() as
                  | 'soul'
                  | 'memory'
                  | 'agents'
                const content = workspace?.[key]
                return (
                  <div
                    key={name}
                    className="rounded-lg border border-primary-200 bg-surface"
                  >
                    <div className="px-4 py-3 border-b border-primary-200">
                      <h3 className="text-sm font-medium text-primary-900">
                        {name}
                      </h3>
                    </div>
                    <div className="p-4 max-h-[400px] overflow-y-auto">
                      {content ? (
                        <pre className="text-xs text-primary-700 whitespace-pre-wrap font-mono">
                          {content}
                        </pre>
                      ) : (
                        <div className="text-xs text-primary-400">
                          Not available
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Shared-Context Tab */}
      {activeTab === 'shared-context' ? (
        <div className="grid grid-cols-[240px_1fr] gap-4 min-h-[500px]">
          {/* Directory Sidebar */}
          <div className="rounded-lg border border-primary-200 bg-surface overflow-hidden">
            <div className="px-3 py-2 border-b border-primary-200 bg-primary-50">
              <div className="text-xs font-medium text-primary-700">
                shared-context/
              </div>
            </div>
            <div className="p-1">
              {/* Priorities link */}
              <button
                onClick={function handlePriorities() {
                  loadFile('.openclaw/shared-context/priorities.md')
                }}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-primary-100 transition-colors',
                  selectedFile?.includes('priorities')
                    ? 'bg-primary-100 text-primary-900'
                    : 'text-primary-700',
                )}
              >
                priorities.md
              </button>

              {/* Directory links */}
              {SHARED_CONTEXT_DIRS.map(function renderDir(dir) {
                return (
                  <button
                    key={dir}
                    onClick={function handleDir() {
                      setActiveDir(dir)
                      setSelectedFile(null)
                      setFileContent(null)
                    }}
                    className={cn(
                      'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-primary-100 transition-colors',
                      activeDir === dir
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-primary-700',
                    )}
                  >
                    {dir}/
                  </button>
                )
              })}
            </div>

            {/* Directory entries */}
            {activeDir && dirQuery.data?.entries ? (
              <div className="border-t border-primary-200 p-1">
                <div className="px-2 py-1 text-[10px] text-primary-500 uppercase">
                  {activeDir}/
                </div>
                {dirQuery.data.entries.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-primary-400">
                    Empty
                  </div>
                ) : (
                  dirQuery.data.entries.map(function renderEntry(entry) {
                    return (
                      <button
                        key={entry.name}
                        onClick={function handleEntry() {
                          if (entry.type === 'file') {
                            loadFile(entry.path)
                          } else {
                            setActiveDir(
                              entry.path.replace(
                                '.openclaw/shared-context/',
                                '',
                              ),
                            )
                          }
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 text-xs rounded hover:bg-primary-100 truncate transition-colors',
                          selectedFile === entry.path
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-primary-600',
                        )}
                      >
                        {entry.type === 'directory' ? `${entry.name}/` : entry.name}
                      </button>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>

          {/* File Viewer */}
          <div className="rounded-lg border border-primary-200 bg-surface overflow-hidden">
            {selectedFile ? (
              <>
                <div className="px-4 py-3 border-b border-primary-200 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-primary-900 truncate">
                    {selectedFile.split('/').pop()}
                  </h3>
                  {selectedFile.includes('priorities') ? (
                    <button
                      onClick={function handleEdit() {
                        setEditingPriorities(!editingPriorities)
                        if (!editingPriorities) {
                          setPrioritiesText(fileContent ?? '')
                        }
                      }}
                      className="text-xs px-3 py-1 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                    >
                      {editingPriorities ? 'Cancel' : 'Edit'}
                    </button>
                  ) : null}
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  {editingPriorities && selectedFile.includes('priorities') ? (
                    <div className="space-y-3">
                      <textarea
                        value={prioritiesText}
                        onChange={function handleChange(e) {
                          setPrioritiesText(e.target.value)
                        }}
                        className="w-full h-[400px] text-xs font-mono bg-primary-50 border border-primary-200 rounded p-3 resize-none outline-none focus:border-blue-400"
                      />
                      <button
                        onClick={function handleSave() {
                          prioritiesMutation.mutate(prioritiesText)
                        }}
                        disabled={prioritiesMutation.isPending}
                        className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {prioritiesMutation.isPending
                          ? 'Saving...'
                          : 'Save Priorities'}
                      </button>
                    </div>
                  ) : fileContent !== null ? (
                    <pre className="text-xs text-primary-700 whitespace-pre-wrap font-mono">
                      {fileContent}
                    </pre>
                  ) : (
                    <div className="text-xs text-primary-400">Loading...</div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-primary-400">
                Select a file to view
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
