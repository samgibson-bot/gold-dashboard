import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  BrowserIcon,
  Clock01Icon,
  CoinsIcon,
  Settings01Icon as ConfigIcon,
  DashboardSquare01Icon,
  File01Icon,
  Idea01Icon,
  PencilEdit02Icon,
  PuzzleIcon,
  Robot01Icon,
  Search01Icon,
  Settings01Icon,
  SidebarLeft01Icon,
} from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useChatSettings } from '../hooks/use-chat-settings'
import { useDeleteSession } from '../hooks/use-delete-session'
import { useRenameSession } from '../hooks/use-rename-session'
import { SettingsDialog } from './settings-dialog'
import { SessionRenameDialog } from './sidebar/session-rename-dialog'
import { SessionDeleteDialog } from './sidebar/session-delete-dialog'
import { SidebarSessions } from './sidebar/sidebar-sessions'
import type { SessionMeta } from '../types'
import { useChatSettingsStore } from '@/hooks/use-chat-settings'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { WebClawIconBig } from '@/components/icons/webclaw-big'

type ChatSidebarProps = {
  sessions: Array<SessionMeta>
  activeFriendlyId: string
  creatingSession: boolean
  onCreateSession: () => void
  onOpenSearch?: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSelectSession?: () => void
  onActiveSessionDelete?: () => void
}

function ChatSidebarComponent({
  sessions,
  activeFriendlyId,
  creatingSession,
  onCreateSession,
  onOpenSearch,
  isCollapsed,
  onToggleCollapse,
  onSelectSession,
  onActiveSessionDelete,
}: ChatSidebarProps) {
  const {
    settingsOpen,
    setSettingsOpen,
    pathsLoading,
    pathsError,
    paths,
    handleOpenSettings,
    closeSettings,
    copySessionsDir,
    copyStorePath,
  } = useChatSettings()
  const { deleteSession } = useDeleteSession()
  const { renameSession } = useRenameSession()
  const workspace = useChatSettingsStore((s) => s.settings.workspace)
  const transition = {
    duration: 0.15,
    ease: isCollapsed ? 'easeIn' : 'easeOut',
  } as const

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameSessionKey, setRenameSessionKey] = useState<string | null>(null)
  const [renameSessionTitle, setRenameSessionTitle] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteSessionKey, setDeleteSessionKey] = useState<string | null>(null)
  const [deleteFriendlyId, setDeleteFriendlyId] = useState<string | null>(null)
  const [deleteSessionTitle, setDeleteSessionTitle] = useState('')

  function handleOpenRename(session: SessionMeta) {
    setRenameSessionKey(session.key)
    setRenameSessionTitle(
      session.label || session.title || session.derivedTitle || '',
    )
    setRenameDialogOpen(true)
  }

  function handleSaveRename(newTitle: string) {
    if (renameSessionKey) {
      void renameSession(renameSessionKey, newTitle)
    }
    setRenameDialogOpen(false)
    setRenameSessionKey(null)
  }

  function handleOpenDelete(session: SessionMeta) {
    setDeleteSessionKey(session.key)
    setDeleteFriendlyId(session.friendlyId)
    setDeleteSessionTitle(
      session.label ||
        session.title ||
        session.derivedTitle ||
        session.friendlyId,
    )
    setDeleteDialogOpen(true)
  }

  function handleConfirmDelete() {
    if (deleteSessionKey && deleteFriendlyId) {
      const isActive = deleteFriendlyId === activeFriendlyId
      if (isActive && onActiveSessionDelete) {
        onActiveSessionDelete()
      }
      void deleteSession(deleteSessionKey, deleteFriendlyId, isActive)
    }
    setDeleteDialogOpen(false)
    setDeleteSessionKey(null)
    setDeleteFriendlyId(null)
  }

  function handleOpenSearch() {
    if (!onOpenSearch) return
    onOpenSearch()
    if (onSelectSession) onSelectSession()
  }

  const asideProps = {
    className:
      'border-r border-primary-200 h-full overflow-hidden bg-primary-100 flex flex-col',
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 48 : 300 }}
      transition={transition}
      className={asideProps.className}
    >
      <motion.div
        layout
        transition={{ layout: transition }}
        className={cn('flex items-center h-12 px-2 justify-between')}
      >
        <AnimatePresence initial={false}>
          {!isCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <Link
                to="/new"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'w-full pl-1.5 justify-start',
                )}
              >
                <WebClawIconBig className="size-5 rounded-sm" />
                WebClaw
              </Link>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger
              onClick={onToggleCollapse}
              render={
                <Button size="icon-sm" variant="ghost">
                  <HugeiconsIcon
                    icon={SidebarLeft01Icon}
                    size={20}
                    strokeWidth={1.5}
                  />
                </Button>
              }
            />
            <TooltipContent side="right">
              {isCollapsed ? 'Open Sidebar' : 'Close Sidebar'}
            </TooltipContent>
          </TooltipRoot>
        </TooltipProvider>
      </motion.div>

      <div className="px-2 mb-4">
        <motion.div
          layout
          transition={{ layout: transition }}
          className="w-full space-y-2"
        >
          <Button
            disabled={creatingSession}
            variant="ghost"
            size="sm"
            onClick={onCreateSession}
            onMouseUp={onSelectSession}
            className="w-full pl-1.5 justify-start"
          >
            <HugeiconsIcon
              icon={PencilEdit02Icon}
              size={20}
              strokeWidth={1.5}
              className="min-w-5"
            />
            <AnimatePresence initial={false} mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  New Session
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
          {onOpenSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSearch}
              title={isCollapsed ? 'Search' : undefined}
              className="w-full pl-1.5 justify-start"
            >
              <HugeiconsIcon
                icon={Search01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Search
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          )}
        </motion.div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="pt-0 flex flex-col w-full min-h-0 h-full"
            >
              <div className="flex-1 min-h-0">
                <SidebarSessions
                  sessions={sessions}
                  activeFriendlyId={activeFriendlyId}
                  onSelect={onSelectSession}
                  onRename={handleOpenRename}
                  onDelete={handleOpenDelete}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-2 py-3 border-t border-primary-200 bg-primary-100 space-y-0.5">
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="px-2 py-1.5 text-xs font-medium text-primary-500"
            >
              Admin
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ layout: transition }}
          className="w-full"
        >
          <Link
            to="/admin/status"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'w-full justify-start pl-1.5',
            )}
          >
            <HugeiconsIcon
              icon={DashboardSquare01Icon}
              size={20}
              strokeWidth={1.5}
              className="min-w-5"
            />
            <AnimatePresence initial={false} mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Status
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </motion.div>

        <motion.div
          layout
          transition={{ layout: transition }}
          className="w-full"
        >
          <Link
            to="/admin/tokens"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'w-full justify-start pl-1.5',
            )}
          >
            <HugeiconsIcon
              icon={CoinsIcon}
              size={20}
              strokeWidth={1.5}
              className="min-w-5"
            />
            <AnimatePresence initial={false} mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Tokens
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </motion.div>

        {workspace.memory && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/memory"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={AiBrain01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Memory
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        {workspace.skills && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/skills"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={PuzzleIcon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Skills
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        {workspace.fleet && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/fleet"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={Robot01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Agents
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        {workspace.logs && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/logs"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={File01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Logs
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        {workspace.cron && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/cron"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={Clock01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Cron
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        <motion.div
          layout
          transition={{ layout: transition }}
          className="w-full"
        >
          <Link
            to="/admin/config"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'w-full justify-start pl-1.5',
            )}
          >
            <HugeiconsIcon
              icon={ConfigIcon}
              size={20}
              strokeWidth={1.5}
              className="min-w-5"
            />
            <AnimatePresence initial={false} mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Config
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </motion.div>

        {workspace.browser && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/browser"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={BrowserIcon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Browser
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        {workspace.ideas && (
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Link
              to="/admin/ideas"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start pl-1.5',
              )}
            >
              <HugeiconsIcon
                icon={Idea01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Ideas
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}

        <div className="pt-1">
          <motion.div
            layout
            transition={{ layout: transition }}
            className="w-full"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSettings}
              title={isCollapsed ? 'Settings' : undefined}
              className="w-full justify-start pl-1.5"
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={20}
                strokeWidth={1.5}
                className="min-w-5"
              />
              <AnimatePresence initial={false} mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Settings
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        pathsLoading={pathsLoading}
        pathsError={pathsError}
        paths={paths}
        onClose={closeSettings}
        onCopySessionsDir={copySessionsDir}
        onCopyStorePath={copyStorePath}
      />

      <SessionRenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        sessionTitle={renameSessionTitle}
        onSave={handleSaveRename}
        onCancel={() => setRenameDialogOpen(false)}
      />

      <SessionDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sessionTitle={deleteSessionTitle}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </motion.aside>
  )
}

function areSessionsEqual(
  prevSessions: Array<SessionMeta>,
  nextSessions: Array<SessionMeta>,
): boolean {
  if (prevSessions === nextSessions) return true
  if (prevSessions.length !== nextSessions.length) return false
  for (let i = 0; i < prevSessions.length; i += 1) {
    const prev = prevSessions[i]
    const next = nextSessions[i]
    if (prev.key !== next.key) return false
    if (prev.friendlyId !== next.friendlyId) return false
    if (prev.label !== next.label) return false
    if (prev.title !== next.title) return false
    if (prev.derivedTitle !== next.derivedTitle) return false
    if (prev.updatedAt !== next.updatedAt) return false
  }
  return true
}

function areSidebarPropsEqual(
  prevProps: ChatSidebarProps,
  nextProps: ChatSidebarProps,
): boolean {
  if (prevProps.activeFriendlyId !== nextProps.activeFriendlyId) return false
  if (prevProps.creatingSession !== nextProps.creatingSession) return false
  if (prevProps.isCollapsed !== nextProps.isCollapsed) return false
  if (prevProps.onOpenSearch !== nextProps.onOpenSearch) return false
  if (!areSessionsEqual(prevProps.sessions, nextProps.sessions)) return false
  return true
}

const MemoizedChatSidebar = memo(ChatSidebarComponent, areSidebarPropsEqual)

export { MemoizedChatSidebar as ChatSidebar }
