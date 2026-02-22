'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { memo, useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isProtectedSession } from '../../utils'
import { chatQueryKeys } from '../../chat-queries'
import { SessionItem } from './session-item'
import type { SessionMeta } from '../../types'
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { usePinnedSessions } from '@/hooks/use-pinned-sessions'
import { Button } from '@/components/ui/button'

type SidebarSessionsProps = {
  sessions: Array<SessionMeta>
  activeFriendlyId: string
  defaultOpen?: boolean
  onSelect?: () => void
  onRename: (session: SessionMeta) => void
  onDelete: (session: SessionMeta) => void
}

async function runWithConcurrency<T>(
  items: Array<T>,
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, () =>
    (async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (item !== undefined) await fn(item)
      }
    })(),
  )
  await Promise.all(workers)
}

async function deleteSessionRequest(sessionKey: string): Promise<void> {
  const res = await fetch('/api/sessions', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionKey }),
  })
  if (!res.ok) throw new Error('Failed to delete session')
}

function GroupSection({
  title,
  sessions,
  activeFriendlyId,
  pinnedSessionSet,
  selectionMode,
  selectedKeys,
  onSelect,
  onRename,
  onDelete,
  onOpenInDeck,
  onTogglePin,
  onToggleSelect,
  defaultOpen = false,
}: {
  title: string
  sessions: Array<SessionMeta>
  activeFriendlyId: string
  pinnedSessionSet: Set<string>
  selectionMode?: boolean
  selectedKeys?: Set<string>
  onSelect?: () => void
  onRename: (session: SessionMeta) => void
  onDelete: (session: SessionMeta) => void
  onOpenInDeck?: (session: SessionMeta) => void
  onTogglePin: (session: SessionMeta) => void
  onToggleSelect?: (session: SessionMeta) => void
  defaultOpen?: boolean
}) {
  if (sessions.length === 0) return null
  return (
    <Collapsible className="w-full" defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="w-fit pl-1.5 shrink-0">
        <span className="text-primary-500">{title}</span>
        <span className="ml-1.5 text-[10px] text-primary-400 bg-primary-200 rounded-full px-1.5 py-0.5 tabular-nums">
          {sessions.length}
        </span>
        <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-3 transition-transform duration-150 group-data-panel-open:rotate-90"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel
        className="w-full data-starting-style:h-0 data-ending-style:h-0"
        contentClassName="flex flex-col"
      >
        <div className="flex flex-col gap-px pl-2 pr-2">
          {sessions.map((session) => (
            <SessionItem
              key={session.key}
              session={session}
              active={session.friendlyId === activeFriendlyId}
              isPinned={pinnedSessionSet.has(session.key)}
              isProtected={isProtectedSession(session.key)}
              selectionMode={selectionMode}
              isSelected={selectedKeys?.has(session.key)}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onToggleSelect={onToggleSelect}
              onRename={onRename}
              onDelete={onDelete}
              onOpenInDeck={onOpenInDeck}
            />
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}

export const SidebarSessions = memo(function SidebarSessions({
  sessions,
  activeFriendlyId,
  defaultOpen = true,
  onSelect,
  onRename,
  onDelete,
}: SidebarSessionsProps) {
  const { pinnedSessionKeys, togglePinnedSession } = usePinnedSessions()
  const queryClient = useQueryClient()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedKeys(new Set())
      return !prev
    })
  }, [])

  const handleToggleSelect = useCallback((session: SessionMeta) => {
    if (isProtectedSession(session.key)) return
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(session.key)) {
        next.delete(session.key)
      } else {
        next.add(session.key)
      }
      return next
    })
  }, [])

  const selectableSessions = useMemo(
    () => sessions.filter((s) => !isProtectedSession(s.key)),
    [sessions],
  )

  const handleSelectAll = useCallback(() => {
    setSelectedKeys(new Set(selectableSessions.map((s) => s.key)))
  }, [selectableSessions])

  const handleBulkDelete = useCallback(async () => {
    if (selectedKeys.size === 0) return
    const confirmed = window.confirm(
      `Delete ${selectedKeys.size} session${selectedKeys.size > 1 ? 's' : ''}? This cannot be undone.`,
    )
    if (!confirmed) return

    setBulkDeleting(true)
    try {
      await runWithConcurrency(
        Array.from(selectedKeys),
        10,
        deleteSessionRequest,
      )
    } finally {
      setBulkDeleting(false)
      setSelectionMode(false)
      setSelectedKeys(new Set())
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions })
    }
  }, [selectedKeys, queryClient])

  const pinnedSessionSet = useMemo(
    () => new Set(pinnedSessionKeys),
    [pinnedSessionKeys],
  )

  const pinnedSessions = useMemo(
    () => sessions.filter((session) => pinnedSessionSet.has(session.key)),
    [sessions, pinnedSessionSet],
  )

  const unpinnedSessions = useMemo(
    () => sessions.filter((session) => !pinnedSessionSet.has(session.key)),
    [sessions, pinnedSessionSet],
  )

  // Group unpinned sessions by kind
  const chatSessions = useMemo(
    () =>
      unpinnedSessions.filter(
        (s) => !s.kind || s.kind === 'chat' || s.kind === 'webchat',
      ),
    [unpinnedSessions],
  )

  const subagentSessions = useMemo(
    () => unpinnedSessions.filter((s) => s.kind === 'subagent'),
    [unpinnedSessions],
  )

  const cronSessions = useMemo(
    () => unpinnedSessions.filter((s) => s.kind === 'cron'),
    [unpinnedSessions],
  )

  const otherSessions = useMemo(
    () => unpinnedSessions.filter((s) => s.kind === 'other'),
    [unpinnedSessions],
  )

  const handleTogglePin = useCallback(
    (session: SessionMeta) => {
      togglePinnedSession(session.key)
    },
    [togglePinnedSession],
  )

  const handleOpenInDeck = useCallback((session: SessionMeta) => {
    window.location.href = `/deck?add=${encodeURIComponent(session.key)}`
  }, [])

  return (
    <Collapsible
      className="flex h-full flex-col flex-1 min-h-0 w-full"
      defaultOpen={defaultOpen}
    >
      <div className="flex items-center justify-between pr-2">
        <CollapsibleTrigger className="w-fit pl-1.5 shrink-0">
          Sessions
          <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-3 transition-transform duration-150 group-data-panel-open:rotate-90"
            />
          </span>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleSelectionMode}
          className="h-6 px-1.5 text-[10px] text-primary-500 hover:text-primary-700"
        >
          {selectionMode ? 'Done' : 'Select'}
        </Button>
      </div>
      <CollapsiblePanel
        className="w-full flex-1 min-h-0 h-auto data-starting-style:h-0 data-ending-style:h-0"
        contentClassName="flex flex-1 min-h-0 flex-col overflow-y-auto"
      >
        <ScrollAreaRoot className="flex-1 min-h-0">
          <ScrollAreaViewport className="min-h-0">
            <div className="flex flex-col gap-px pl-2 pr-2">
              {/* Pinned sessions */}
              {pinnedSessions.map((session) => (
                <SessionItem
                  key={session.key}
                  session={session}
                  active={session.friendlyId === activeFriendlyId}
                  isPinned
                  isProtected={isProtectedSession(session.key)}
                  selectionMode={selectionMode}
                  isSelected={selectedKeys.has(session.key)}
                  onSelect={onSelect}
                  onTogglePin={handleTogglePin}
                  onToggleSelect={handleToggleSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onOpenInDeck={
                    session.kind === 'subagent' ? handleOpenInDeck : undefined
                  }
                />
              ))}

              {pinnedSessions.length > 0 &&
              (chatSessions.length > 0 ||
                subagentSessions.length > 0 ||
                cronSessions.length > 0 ||
                otherSessions.length > 0) ? (
                <div className="my-1 border-t border-primary-200/80" />
              ) : null}
            </div>

            {/* Chat group — non-collapsible */}
            {chatSessions.length > 0 ? (
              <div className="flex flex-col gap-px pl-2 pr-2">
                {chatSessions.map((session) => (
                  <SessionItem
                    key={session.key}
                    session={session}
                    active={session.friendlyId === activeFriendlyId}
                    isPinned={false}
                    isProtected={isProtectedSession(session.key)}
                    selectionMode={selectionMode}
                    isSelected={selectedKeys.has(session.key)}
                    onSelect={onSelect}
                    onTogglePin={handleTogglePin}
                    onToggleSelect={handleToggleSelect}
                    onRename={onRename}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : null}

            {/* Sub-agents group — collapsible, collapsed by default */}
            {subagentSessions.length > 0 ? (
              <div className="mt-1 pl-2 pr-2">
                <GroupSection
                  title="Sub-agents"
                  sessions={subagentSessions}
                  activeFriendlyId={activeFriendlyId}
                  pinnedSessionSet={pinnedSessionSet}
                  selectionMode={selectionMode}
                  selectedKeys={selectedKeys}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onOpenInDeck={handleOpenInDeck}
                  onTogglePin={handleTogglePin}
                  onToggleSelect={handleToggleSelect}
                  defaultOpen={false}
                />
              </div>
            ) : null}

            {/* Cron group — collapsible, collapsed by default */}
            {cronSessions.length > 0 ? (
              <div className="mt-1 pl-2 pr-2">
                <GroupSection
                  title="Cron"
                  sessions={cronSessions}
                  activeFriendlyId={activeFriendlyId}
                  pinnedSessionSet={pinnedSessionSet}
                  selectionMode={selectionMode}
                  selectedKeys={selectedKeys}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onTogglePin={handleTogglePin}
                  onToggleSelect={handleToggleSelect}
                  defaultOpen={false}
                />
              </div>
            ) : null}

            {/* Other group — collapsible, collapsed by default */}
            {otherSessions.length > 0 ? (
              <div className="mt-1 pl-2 pr-2">
                <GroupSection
                  title="Other"
                  sessions={otherSessions}
                  activeFriendlyId={activeFriendlyId}
                  pinnedSessionSet={pinnedSessionSet}
                  selectionMode={selectionMode}
                  selectedKeys={selectedKeys}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onTogglePin={handleTogglePin}
                  onToggleSelect={handleToggleSelect}
                  defaultOpen={false}
                />
              </div>
            ) : null}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical">
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
        </ScrollAreaRoot>
      </CollapsiblePanel>

      {selectionMode && (
        <div className="border-t border-primary-200 px-2 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-primary-600">
            <span>{selectedKeys.size} selected</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 px-1.5 text-[10px]"
            >
              Select all ({selectableSessions.length})
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedKeys.size === 0 || bulkDeleting}
              onClick={handleBulkDelete}
              className="flex-1 h-7 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              {bulkDeleting ? 'Deleting…' : `Delete (${selectedKeys.size})`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleSelectionMode}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Collapsible>
  )
}, areSidebarSessionsEqual)

function areSidebarSessionsEqual(
  prev: SidebarSessionsProps,
  next: SidebarSessionsProps,
) {
  if (prev.activeFriendlyId !== next.activeFriendlyId) return false
  if (prev.defaultOpen !== next.defaultOpen) return false
  if (prev.onSelect !== next.onSelect) return false
  if (prev.onRename !== next.onRename) return false
  if (prev.onDelete !== next.onDelete) return false
  if (prev.sessions === next.sessions) return true
  if (prev.sessions.length !== next.sessions.length) return false
  for (let i = 0; i < prev.sessions.length; i += 1) {
    const prevSession = prev.sessions[i]
    const nextSession = next.sessions[i]
    if (prevSession.key !== nextSession.key) return false
    if (prevSession.friendlyId !== nextSession.friendlyId) return false
    if (prevSession.label !== nextSession.label) return false
    if (prevSession.title !== nextSession.title) return false
    if (prevSession.derivedTitle !== nextSession.derivedTitle) return false
    if (prevSession.updatedAt !== nextSession.updatedAt) return false
    if (prevSession.kind !== nextSession.kind) return false
  }
  return true
}
