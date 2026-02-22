import {
  Activity01Icon,
  Analytics01Icon,
  BrowserIcon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  File01Icon,
  FolderDetailsIcon,
  FolderOpenIcon,
  Idea01Icon,
  LayoutGridIcon,
  PencilEdit02Icon,
  PuzzleIcon,
  Settings01Icon,
  UserGroupIcon,
  WebhookIcon,
  WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'

export type NavItem = {
  to: string
  label: string
  icon: typeof DashboardSquare01Icon
}

export type NavSection = {
  title: string
  items: Array<NavItem>
}

export const navSections: Array<NavSection> = [
  {
    title: 'Chat',
    items: [
      { to: '/new', label: 'New Chat', icon: PencilEdit02Icon },
      { to: '/deck', label: 'Deck', icon: LayoutGridIcon },
    ],
  },
  {
    title: 'Overview',
    items: [
      { to: '/admin/status', label: 'Status', icon: DashboardSquare01Icon },
      { to: '/admin/activity', label: 'Activity', icon: Activity01Icon },
      { to: '/admin/metrics', label: 'Metrics', icon: Analytics01Icon },
    ],
  },
  {
    title: 'Agents',
    items: [
      { to: '/admin/fleet', label: 'Fleet', icon: UserGroupIcon },
      { to: '/admin/workflows', label: 'Workflows', icon: WorkflowSquare01Icon },
      { to: '/admin/memory', label: 'Memory', icon: FolderDetailsIcon },
      { to: '/admin/approvals', label: 'Approvals', icon: CheckmarkBadge01Icon },
    ],
  },
  {
    title: 'Ideas',
    items: [{ to: '/admin/ideas', label: 'Ideas', icon: Idea01Icon }],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/logs', label: 'Logs', icon: File01Icon },
      { to: '/admin/cron', label: 'Cron', icon: Clock01Icon },
      { to: '/admin/browser', label: 'Browser', icon: BrowserIcon },
      { to: '/admin/webhooks', label: 'Webhooks', icon: WebhookIcon },
      { to: '/admin/skills', label: 'Skills', icon: PuzzleIcon },
      { to: '/admin/files', label: 'Files', icon: FolderOpenIcon },
      { to: '/admin/config', label: 'Config', icon: Settings01Icon },
    ],
  },
]
