import { createFileRoute, Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardSquare01Icon,
  Coins01Icon,
  FileScriptIcon,
  Settings01Icon,
  BrowserIcon,
  Calendar03Icon,
  Target01Icon,
  Idea01Icon,
  MessageMultiple01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgObject } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: IndexRoute,
})

type QuickActionCard = {
  id: string
  label: string
  description: string
  icon: IconSvgObject
  to: string
  color: string
}

const quickActions: QuickActionCard[] = [
  {
    id: 'chat',
    label: 'Chat',
    description: 'Talk to OpenClaw',
    icon: MessageMultiple01Icon,
    to: '/chat/main',
    color: 'blue',
  },
  {
    id: 'ideas',
    label: 'Ideas',
    description: 'View and submit ideas',
    icon: Idea01Icon,
    to: '/admin/ideas',
    color: 'yellow',
  },
  {
    id: 'status',
    label: 'System Status',
    description: 'Monitor OpenClaw health',
    icon: DashboardSquare01Icon,
    to: '/admin/status',
    color: 'green',
  },
  {
    id: 'tokens',
    label: 'Token Usage',
    description: 'Track costs and usage',
    icon: Coins01Icon,
    to: '/admin/tokens',
    color: 'violet',
  },
  {
    id: 'logs',
    label: 'Logs',
    description: 'View system logs',
    icon: FileScriptIcon,
    to: '/admin/logs',
    color: 'orange',
  },
  {
    id: 'cron',
    label: 'Cron Jobs',
    description: 'Manage scheduled tasks',
    icon: Calendar03Icon,
    to: '/admin/cron',
    color: 'cyan',
  },
  {
    id: 'browser',
    label: 'Browser',
    description: 'Browser automation',
    icon: BrowserIcon,
    to: '/admin/browser',
    color: 'indigo',
  },
  {
    id: 'missions',
    label: 'Missions',
    description: 'View active missions',
    icon: Target01Icon,
    to: '/admin/missions',
    color: 'pink',
  },
  {
    id: 'config',
    label: 'Config',
    description: 'System configuration',
    icon: Settings01Icon,
    to: '/admin/config',
    color: 'gray',
  },
]

const colorClasses: Record<
  string,
  { bg: string; icon: string; hover: string }
> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/40',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    icon: 'text-yellow-600 dark:text-yellow-400',
    hover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/40',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    icon: 'text-green-600 dark:text-green-400',
    hover: 'hover:bg-green-100 dark:hover:bg-green-900/40',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'text-violet-600 dark:text-violet-400',
    hover: 'hover:bg-violet-100 dark:hover:bg-violet-900/40',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    icon: 'text-orange-600 dark:text-orange-400',
    hover: 'hover:bg-orange-100 dark:hover:bg-orange-900/40',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    icon: 'text-cyan-600 dark:text-cyan-400',
    hover: 'hover:bg-cyan-100 dark:hover:bg-cyan-900/40',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    icon: 'text-indigo-600 dark:text-indigo-400',
    hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/40',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    icon: 'text-pink-600 dark:text-pink-400',
    hover: 'hover:bg-pink-100 dark:hover:bg-pink-900/40',
  },
  gray: {
    bg: 'bg-primary-50',
    icon: 'text-primary-600',
    hover: 'hover:bg-primary-100',
  },
}

function IndexRoute() {
  return (
    <div className="min-h-screen bg-primary-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-primary-950 mb-2">
            Gold Dashboard
          </h1>
          <p className="text-primary-600">
            Admin interface for OpenClaw · Press{' '}
            <kbd className="px-2 py-1 text-xs font-medium bg-primary-100 border border-primary-200 rounded">
              ⌘K
            </kbd>{' '}
            for quick actions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map(function renderAction(action) {
            const colors = colorClasses[action.color]
            return (
              <Link
                key={action.id}
                to={action.to}
                className={cn(
                  'group flex items-start gap-4 p-6 rounded-2xl border border-primary-200 transition-all',
                  colors.bg,
                  colors.hover,
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-primary-900 shadow-sm transition-transform group-hover:scale-110',
                  )}
                >
                  <HugeiconsIcon
                    icon={action.icon}
                    size={24}
                    strokeWidth={1.6}
                    className={colors.icon}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-primary-900 mb-1">
                    {action.label}
                  </h3>
                  <p className="text-sm text-primary-600">
                    {action.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
