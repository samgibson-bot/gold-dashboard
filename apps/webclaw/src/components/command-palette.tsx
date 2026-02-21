'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog } from '@base-ui/react/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import Fuse from 'fuse.js'
import {
  Activity01Icon,
  Analytics01Icon,
  BrowserIcon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  Coins01Icon,
  DashboardSquare01Icon,
  FileScriptIcon,
  FolderDetailsIcon,
  Idea01Icon,
  Settings01Icon,
  Target01Icon,
  UserGroupIcon,
  WebhookIcon,
  WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgObject } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type QuickAction = {
  id: string
  label: string
  description: string
  icon: IconSvgObject
  keywords: Array<string>
  action: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()

  const actions: Array<QuickAction> = useMemo(
    () => [
      {
        id: 'new-idea',
        label: 'New Idea',
        description: 'Submit a new idea for OpenClaw',
        icon: Idea01Icon,
        keywords: ['create', 'add', 'new', 'idea', 'submit'],
        action: () => {
          navigate({ to: '/admin/ideas' })
          setOpen(false)
        },
      },
      {
        id: 'ideas',
        label: 'Ideas',
        description: 'View and manage ideas',
        icon: Idea01Icon,
        keywords: [
          'ideas',
          'view',
          'list',
          'manage',
          'kanban',
          'board',
          'workflow',
        ],
        action: () => {
          navigate({ to: '/admin/ideas' })
          setOpen(false)
        },
      },
      {
        id: 'status',
        label: 'System Status',
        description: 'View OpenClaw system status',
        icon: DashboardSquare01Icon,
        keywords: ['status', 'dashboard', 'overview', 'system'],
        action: () => {
          navigate({ to: '/admin/status' })
          setOpen(false)
        },
      },
      {
        id: 'tokens',
        label: 'Token Usage & Costs',
        description: 'View token usage and cost analytics',
        icon: Coins01Icon,
        keywords: ['tokens', 'usage', 'cost', 'analytics', 'spending'],
        action: () => {
          navigate({ to: '/admin/tokens' })
          setOpen(false)
        },
      },
      {
        id: 'logs',
        label: 'Logs',
        description: 'View system logs',
        icon: FileScriptIcon,
        keywords: ['logs', 'history', 'debug'],
        action: () => {
          navigate({ to: '/admin/logs' })
          setOpen(false)
        },
      },
      {
        id: 'cron',
        label: 'Cron Jobs',
        description: 'Manage scheduled tasks',
        icon: Calendar03Icon,
        keywords: ['cron', 'schedule', 'jobs', 'tasks'],
        action: () => {
          navigate({ to: '/admin/cron' })
          setOpen(false)
        },
      },
      {
        id: 'browser',
        label: 'Browser Agent',
        description: 'Manage browser automation',
        icon: BrowserIcon,
        keywords: ['browser', 'automation', 'agent'],
        action: () => {
          navigate({ to: '/admin/browser' })
          setOpen(false)
        },
      },
      {
        id: 'missions',
        label: 'Missions',
        description: 'View and manage missions',
        icon: Target01Icon,
        keywords: ['missions', 'tasks', 'goals'],
        action: () => {
          navigate({ to: '/admin/missions' })
          setOpen(false)
        },
      },
      {
        id: 'fleet',
        label: 'Fleet Management',
        description: 'Manage soul fleet agents',
        icon: UserGroupIcon,
        keywords: ['fleet', 'agents', 'souls', 'spawn', 'models'],
        action: () => {
          navigate({ to: '/admin/fleet' })
          setOpen(false)
        },
      },
      {
        id: 'memory',
        label: 'Memory & Context',
        description: 'View workspace and shared-context',
        icon: FolderDetailsIcon,
        keywords: ['memory', 'workspace', 'context', 'shared', 'soul'],
        action: () => {
          navigate({ to: '/admin/memory' })
          setOpen(false)
        },
      },
      {
        id: 'activity',
        label: 'Activity Feed',
        description: 'View unified activity feed',
        icon: Activity01Icon,
        keywords: ['activity', 'feed', 'events', 'log'],
        action: () => {
          navigate({ to: '/admin/activity' })
          setOpen(false)
        },
      },
      {
        id: 'approvals',
        label: 'Approvals',
        description: 'Review and approve decisions',
        icon: CheckmarkBadge01Icon,
        keywords: ['approvals', 'approve', 'reject', 'review', 'decisions'],
        action: () => {
          navigate({ to: '/admin/approvals' })
          setOpen(false)
        },
      },
      {
        id: 'metrics',
        label: 'Metrics',
        description: 'Performance and cost analytics',
        icon: Analytics01Icon,
        keywords: ['metrics', 'analytics', 'performance', 'cost', 'kpi'],
        action: () => {
          navigate({ to: '/admin/metrics' })
          setOpen(false)
        },
      },
      {
        id: 'workflows',
        label: 'Workflows',
        description: 'View pipelines and review chains',
        icon: WorkflowSquare01Icon,
        keywords: ['workflows', 'pipeline', 'review', 'chain', 'cron'],
        action: () => {
          navigate({ to: '/admin/workflows' })
          setOpen(false)
        },
      },
      {
        id: 'webhooks',
        label: 'Webhooks',
        description: 'Manage webhook integrations',
        icon: WebhookIcon,
        keywords: ['webhooks', 'integration', 'external', 'events'],
        action: () => {
          navigate({ to: '/admin/webhooks' })
          setOpen(false)
        },
      },
      {
        id: 'config',
        label: 'Configuration',
        description: 'View system configuration',
        icon: Settings01Icon,
        keywords: ['config', 'settings', 'configuration'],
        action: () => {
          navigate({ to: '/admin/config' })
          setOpen(false)
        },
      },
    ],
    [navigate],
  )

  const fuse = useMemo(
    () =>
      new Fuse(actions, {
        keys: ['label', 'description', 'keywords'],
        threshold: 0.3,
        includeScore: true,
      }),
    [actions],
  )

  const filteredActions = useMemo(() => {
    if (!search.trim()) return actions
    return fuse.search(search).map((result) => result.item)
  }, [search, fuse, actions])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }

      if (!open) return

      if (e.key === 'Escape') {
        if (search) {
          setSearch('')
        } else {
          setOpen(false)
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredActions.length - 1 ? prev + 1 : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredActions.length - 1,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const action = filteredActions[selectedIndex]
        if (action) {
          action.action()
          setSearch('')
        }
      }
    },
    [open, filteredActions, selectedIndex],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-ink/40 transition-all duration-150 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 dark:bg-surface/40 z-50" />
        <Dialog.Popup
          className={cn(
            'fixed left-1/2 top-[20vh] -translate-x-1/2',
            'w-[min(640px,92vw)] rounded-[20px] border border-primary-200 bg-primary-50 p-0 shadow-2xl',
            'transition-all duration-150',
            'data-[state=open]:opacity-100 data-[state=closed]:opacity-0',
            'data-[state=open]:scale-100 data-[state=closed]:scale-95',
            'z-50',
          )}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-primary-200 px-4 py-3">
              <svg
                className="h-5 w-5 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search for actions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-primary-900 placeholder:text-primary-400 outline-none"
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-primary-400 hover:text-primary-700 p-0.5 rounded transition-colors"
                  aria-label="Clear search"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
                </button>
              ) : (
                <kbd className="px-2 py-1 text-xs font-medium text-primary-500 bg-primary-100 border border-primary-200 rounded">
                  ESC
                </kbd>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto py-2">
              {filteredActions.length > 0 ? (
                filteredActions.map((action, index) => {
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        action.action()
                        setSearch('')
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-primary-100'
                          : 'hover:bg-primary-100',
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-10 h-10 rounded-lg',
                          index === selectedIndex
                            ? 'bg-primary-200'
                            : 'bg-primary-100',
                        )}
                      >
                        <HugeiconsIcon
                          icon={action.icon}
                          size={20}
                          strokeWidth={1.6}
                          className="text-primary-700"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-primary-900">
                          {action.label}
                        </div>
                        <div className="text-xs text-primary-600 truncate">
                          {action.description}
                        </div>
                      </div>
                      {index === selectedIndex && (
                        <kbd className="px-2 py-1 text-xs font-medium text-primary-500 bg-primary-50 border border-primary-200 rounded">
                          ⏎
                        </kbd>
                      )}
                    </button>
                  )
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-primary-500">
                  No actions found
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-primary-200 px-4 py-2 text-xs text-primary-500">
              <span>Navigate with ↑↓ • Select with ⏎</span>
              <kbd className="px-2 py-1 font-medium bg-primary-100 border border-primary-200 rounded">
                ⌘K
              </kbd>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
