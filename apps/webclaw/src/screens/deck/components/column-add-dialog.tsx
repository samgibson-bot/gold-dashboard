'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDeckStore } from '../deck-store'
import type { SessionMeta } from '@/screens/chat/types'
import { chatQueryKeys, fetchSessions } from '@/screens/chat/chat-queries'
import { cn } from '@/lib/utils'
import { DialogContent, DialogRoot, DialogTitle } from '@/components/ui/dialog'

type ColumnAddDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KIND_LABELS: Record<string, string> = {
  chat: 'Chat',
  webchat: 'Web',
  subagent: 'Agent',
  cron: 'Cron',
  other: 'Other',
}

export function ColumnAddDialog({ open, onOpenChange }: ColumnAddDialogProps) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing')
  const [search, setSearch] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const addColumn = useDeckStore((s) => s.addColumn)

  const sessionsQuery = useQuery({
    queryKey: chatQueryKeys.sessions,
    queryFn: fetchSessions,
    enabled: open && tab === 'existing',
  })

  function handleAddExisting(session: SessionMeta) {
    const label =
      session.label ||
      session.title ||
      session.derivedTitle ||
      session.friendlyId
    addColumn(session.key, label)
    onOpenChange(false)
  }

  function handleAddNew() {
    const label = newLabel.trim() || 'New Session'
    addColumn('', label)
    onOpenChange(false)
    setNewLabel('')
  }

  const sessions = sessionsQuery.data ?? []
  const filteredSessions = sessions.filter((s) => {
    if (!search) return true
    const label = s.label || s.title || s.derivedTitle || s.friendlyId || ''
    return label.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,92vw)]">
        <div className="px-5 pt-5 pb-4">
          <DialogTitle className="text-sm font-semibold text-primary-950 mb-4">
            Add Column
          </DialogTitle>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-primary-200 mb-4">
            <button
              onClick={() => setTab('existing')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === 'existing'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-primary-500 hover:text-primary-700',
              )}
            >
              Existing Session
            </button>
            <button
              onClick={() => setTab('new')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === 'new'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-primary-500 hover:text-primary-700',
              )}
            >
              New Session
            </button>
          </div>

          {tab === 'existing' ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search sessions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs border border-primary-200 rounded-md px-3 py-1.5 outline-none focus:border-primary-400 transition-colors"
              />
              <div className="max-h-[280px] overflow-y-auto space-y-0.5">
                {sessionsQuery.isLoading ? (
                  <div className="text-xs text-primary-400 py-4 text-center">
                    Loading sessions…
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="text-xs text-primary-400 py-4 text-center">
                    No sessions found
                  </div>
                ) : (
                  filteredSessions.map((session) => {
                    const label =
                      session.label ||
                      session.title ||
                      session.derivedTitle ||
                      session.friendlyId
                    return (
                      <button
                        key={session.key}
                        onClick={() => handleAddExisting(session)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left hover:bg-primary-50 transition-colors"
                      >
                        {session.kind ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-500 shrink-0">
                            {KIND_LABELS[session.kind] ?? session.kind}
                          </span>
                        ) : null}
                        <span className="text-xs text-primary-900 truncate flex-1">
                          {label}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-primary-600 block mb-1">
                  Column label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Research Agent"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNew()
                  }}
                  className="w-full text-xs border border-primary-200 rounded-md px-3 py-1.5 outline-none focus:border-primary-400 transition-colors"
                  autoFocus
                />
              </div>
              <button
                onClick={handleAddNew}
                className="w-full text-xs px-3 py-2 rounded-md font-medium bg-primary-900 text-white hover:bg-primary-800 transition-colors"
              >
                Create Column
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
