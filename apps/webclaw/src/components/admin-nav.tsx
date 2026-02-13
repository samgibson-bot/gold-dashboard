import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardSquare01Icon,
  CoinsIcon,
  File01Icon,
  Clock01Icon,
  Settings01Icon,
  BrowserIcon,
  Idea01Icon,
  ArrowLeft01Icon,
  CpuIcon,
  KanbanIcon,
  UserGroupIcon,
  Activity01Icon,
  CheckmarkBadge01Icon,
  Analytics01Icon,
  WebhookIcon,
  WorkflowSquare01Icon,
  FolderDetailsIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: typeof DashboardSquare01Icon
}

const navItems: Array<NavItem> = [
  { to: '/admin/status', label: 'Status', icon: DashboardSquare01Icon },
  { to: '/admin/system', label: 'System', icon: CpuIcon },
  { to: '/admin/kanban', label: 'Kanban', icon: KanbanIcon },
  { to: '/admin/tokens', label: 'Tokens', icon: CoinsIcon },
  { to: '/admin/logs', label: 'Logs', icon: File01Icon },
  { to: '/admin/cron', label: 'Cron', icon: Clock01Icon },
  { to: '/admin/config', label: 'Config', icon: Settings01Icon },
  { to: '/admin/fleet', label: 'Fleet', icon: UserGroupIcon },
  { to: '/admin/memory', label: 'Memory', icon: FolderDetailsIcon },
  { to: '/admin/activity', label: 'Activity', icon: Activity01Icon },
  { to: '/admin/approvals', label: 'Approvals', icon: CheckmarkBadge01Icon },
  { to: '/admin/metrics', label: 'Metrics', icon: Analytics01Icon },
  { to: '/admin/workflows', label: 'Workflows', icon: WorkflowSquare01Icon },
  { to: '/admin/webhooks', label: 'Webhooks', icon: WebhookIcon },
  { to: '/admin/browser', label: 'Browser', icon: BrowserIcon },
  { to: '/admin/missions', label: 'Missions', icon: Idea01Icon },
]

export function AdminNav() {
  return (
    <nav className="w-52 border-r border-primary-200 bg-primary-100 flex flex-col h-full">
      <div className="px-3 h-12 flex items-center border-b border-primary-200">
        <Link
          to="/new"
          className="text-sm text-primary-500 hover:text-primary-900 flex items-center gap-1.5"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} />
          Chat
        </Link>
      </div>
      <div className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(function renderNavItem(item) {
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-primary-700 hover:bg-primary-200 transition-colors [&.active]:bg-primary-200 [&.active]:text-primary-950"
              activeProps={{ className: 'active' }}
            >
              <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.5} />
              {item.label}
            </Link>
          )
        })}
      </div>
      <div className="px-3 py-3 border-t border-primary-200 text-xs text-primary-400">
        Gold Dashboard
      </div>
    </nav>
  )
}
