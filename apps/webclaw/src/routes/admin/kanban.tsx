import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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

type KanbanColumn = {
  status: string
  title: string
  color: string
  ideas: IdeaFile[]
}

const COLUMN_CONFIG: Array<{
  status: string
  title: string
  color: string
}> = [
  {
    status: 'seed',
    title: 'Seed',
    color: 'bg-primary-100 border-primary-300',
  },
  {
    status: 'elaborating',
    title: 'Elaborating',
    color: 'bg-blue-50 border-blue-300',
  },
  {
    status: 'reviewing',
    title: 'Reviewing',
    color: 'bg-amber-50 border-amber-300',
  },
  {
    status: 'validated',
    title: 'Validated',
    color: 'bg-green-50 border-green-300',
  },
  {
    status: 'building',
    title: 'Building',
    color: 'bg-purple-50 border-purple-300',
  },
  {
    status: 'completed',
    title: 'Completed',
    color: 'bg-emerald-50 border-emerald-300',
  },
]

const STATUS_COLORS: Record<string, string> = {
  seed: 'bg-primary-200 text-primary-700 dark:bg-primary-700 dark:text-primary-200',
  elaborating:
    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  reviewing:
    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  validated:
    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  building:
    'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  completed:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  archived:
    'bg-primary-100 text-primary-400 dark:bg-primary-800 dark:text-primary-400',
  unknown:
    'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-400',
}

export const Route = createFileRoute('/admin/kanban')({
  component: KanbanPage,
})

function KanbanPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.ideas,
    queryFn: async function fetchIdeas() {
      const res = await fetch('/api/admin/ideas')
      if (!res.ok) throw new Error('Failed to fetch ideas')
      return (await res.json()) as IdeasResponse
    },
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading Kanban...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      </div>
    )
  }

  const files = data?.ideas?.files ?? []

  // Group ideas by status
  const columns: KanbanColumn[] = COLUMN_CONFIG.map(function createColumn(
    config,
  ) {
    return {
      ...config,
      ideas: files.filter(function filterByStatus(file) {
        return file.status === config.status
      }),
    }
  })

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h1 className="text-lg font-medium text-primary-950">
          Ideas Kanban Board
        </h1>
        <p className="text-sm text-primary-600 mt-1">
          {files.length} total ideas across {columns.length} stages
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full pb-4" style={{ minWidth: 'max-content' }}>
          {columns.map(function renderColumn(column) {
            return (
              <div
                key={column.status}
                className="flex flex-col w-[320px] flex-shrink-0"
              >
                {/* Column Header */}
                <div
                  className={cn(
                    'rounded-t-lg border-t border-x p-3',
                    column.color,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm text-primary-900">
                      {column.title}
                    </h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white dark:bg-primary-800 text-primary-600">
                      {column.ideas.length}
                    </span>
                  </div>
                </div>

                {/* Column Content */}
                <div
                  className={cn(
                    'flex-1 overflow-y-auto border-x border-b rounded-b-lg p-2 space-y-2 bg-primary-50',
                    column.color,
                  )}
                >
                  {column.ideas.length === 0 ? (
                    <div className="text-center py-8 text-sm text-primary-400">
                      No ideas
                    </div>
                  ) : (
                    column.ideas.map(function renderCard(idea) {
                      return (
                        <div
                          key={idea.path}
                          className="bg-white dark:bg-primary-900 border border-primary-200 dark:border-primary-700 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer group"
                        >
                          <h4 className="font-medium text-sm text-primary-900 dark:text-primary-100 mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {idea.title}
                          </h4>

                          {/* Metadata */}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {idea.issueNumber ? (
                              <a
                                href={idea.issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={function handleClick(e) {
                                  e.stopPropagation()
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-800"
                              >
                                #{idea.issueNumber}
                              </a>
                            ) : null}
                            {idea.prNumber ? (
                              <a
                                href={idea.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={function handleClick(e) {
                                  e.stopPropagation()
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 font-medium hover:bg-amber-200 dark:hover:bg-amber-800"
                              >
                                PR #{idea.prNumber}
                              </a>
                            ) : null}
                          </div>

                          {/* Tags */}
                          {idea.tags && idea.tags.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {idea.tags.slice(0, 3).map(function renderTag(tag) {
                                return (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-600 dark:bg-primary-800 dark:text-primary-300"
                                  >
                                    {tag}
                                  </span>
                                )
                              })}
                              {idea.tags.length > 3 ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-400">
                                  +{idea.tags.length - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Created date */}
                          {idea.created ? (
                            <div className="mt-2 pt-2 border-t border-primary-100 dark:border-primary-800">
                              <span className="text-[10px] text-primary-500 dark:text-primary-400">
                                {new Date(idea.created).toLocaleDateString()}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
