'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { memo, useCallback, useMemo } from 'react'
import { isProtectedSession } from '../../utils'
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

type SidebarSessionsProps = {
  sessions: Array<SessionMeta>
  activeFriendlyId: string
  defaultOpen?: boolean
  onSelect?: () => void
  onRename: (session: SessionMeta) => void
  onDelete: (session: SessionMeta) => void
}

function GroupSection({
  title,
  sessions,
  activeFriendlyId,
  pinnedSessionSet,
  onSelect,
  onRename,
  onDelete,
  onOpenInDeck,
  onTogglePin,
  defaultOpen = false,
}: {
  title: string
  sessions: Array<SessionMeta>
  activeFriendlyId: string
  pinnedSessionSet: Set<string>
  onSelect?: () => void
  onRename: (session: SessionMeta) => void
  onDelete: (session: SessionMeta) => void
  onOpenInDeck?: (session: SessionMeta) => void
  onTogglePin: (session: SessionMeta) => void
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
              onSelect={onSelect}
              onTogglePin={onTogglePin}
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
      <CollapsibleTrigger className="w-fit pl-1.5 shrink-0">
        Sessions
        <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-3 transition-transform duration-150 group-data-panel-open:rotate-90"
          />
        </span>
      </CollapsibleTrigger>
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
                  onSelect={onSelect}
                  onTogglePin={handleTogglePin}
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
                    onSelect={onSelect}
                    onTogglePin={handleTogglePin}
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
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onOpenInDeck={handleOpenInDeck}
                  onTogglePin={handleTogglePin}
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
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onTogglePin={handleTogglePin}
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
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onTogglePin={handleTogglePin}
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
