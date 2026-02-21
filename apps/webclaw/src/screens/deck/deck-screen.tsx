'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { useDeckStore } from './deck-store'
import { AgentColumn } from './components/agent-column'
import { DeckHeader } from './components/deck-header'
import { ColumnAddDialog } from './components/column-add-dialog'
import { chatQueryKeys, fetchSessions } from '@/screens/chat/chat-queries'
import { useQuery } from '@tanstack/react-query'
import type { DeckColumn } from './types'

// Parse SSE events and route to store actions
function handleGatewayEvent(
  data: unknown,
  columns: Array<DeckColumn>,
  store: ReturnType<typeof useDeckStore.getState>,
) {
  if (!data || typeof data !== 'object') return
  const frame = data as Record<string, unknown>

  if (frame.event === 'agent') {
    const payload = frame.payload as Record<string, unknown> | undefined
    if (!payload) return
    const { stream, data: eventData, sessionKey } = payload as {
      stream?: string
      data?: Record<string, unknown>
      sessionKey?: string
    }

    // Extract column ID from sessionKey: "agent:main:<columnId>"
    const parts = (sessionKey ?? '').split(':')
    const columnId = parts[2] ?? parts[1] ?? null
    if (!columnId) return

    const col = columns.find(
      (c) => c.id === columnId || c.sessionKey === sessionKey,
    )
    if (!col) return
    const resolvedId = col.id

    if (stream === 'assistant' && eventData?.delta) {
      store.appendDelta(resolvedId, String(eventData.delta))
    } else if (stream === 'lifecycle') {
      if (eventData?.status)
        store.setColumnStatus(resolvedId, eventData.status as never)
      if (eventData?.model)
        store.setColumnModel(resolvedId, String(eventData.model))
      if (eventData?.done) store.finalizeMessage(resolvedId)
    } else if (stream === 'tool_use') {
      // Tool use currently shown via status badge
      store.setColumnStatus(resolvedId, 'tool_use')
    }
  } else if (frame.event === 'sessions.usage') {
    const payload = frame.payload as Record<string, unknown> | undefined
    if (!payload) return
    const sessionKey = String(payload.sessionKey ?? '')
    const col = columns.find((c) => c.sessionKey === sessionKey)
    if (!col) return
    store.updateColumnUsage(
      col.id,
      Number(payload.totalTokens ?? 0),
      payload.contextTokens ? Number(payload.contextTokens) : undefined,
    )
  } else if (frame.event === 'compaction') {
    const payload = frame.payload as Record<string, unknown> | undefined
    if (!payload) return
    const sessionKey = String(payload.sessionKey ?? '')
    const col = columns.find((c) => c.sessionKey === sessionKey)
    if (!col) return
    store.appendCompaction(col.id, {
      beforeTokens: Number(payload.beforeTokens ?? 0),
      afterTokens: Number(payload.afterTokens ?? 0),
      droppedMessages: Number(payload.droppedMessages ?? 0),
    })
  }
}

function DeckEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <div className="text-4xl mb-4">⚡</div>
        <h2 className="text-sm font-semibold text-primary-950 mb-2">
          OpenClaw Deck
        </h2>
        <p className="text-xs text-primary-400 mb-4 max-w-xs">
          Watch multiple agent sessions stream in parallel. Add a column to get
          started.
        </p>
        <button
          onClick={onAdd}
          className="text-xs px-4 py-2 rounded-md font-medium bg-primary-900 text-white hover:bg-primary-800 transition-colors"
        >
          Add First Column
        </button>
      </div>
    </div>
  )
}

export function DeckScreen() {
  const columns = useDeckStore((s) => s.columns)
  const mode = useDeckStore((s) => s.mode)
  const addColumn = useDeckStore((s) => s.addColumn)
  const store = useDeckStore.getState
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map())

  // Handle URL ?add=<sessionKey> query param
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const addParam = typeof search.add === 'string' ? search.add : null

  useEffect(() => {
    if (!addParam) return
    addColumn(addParam, '')
    // Clear the param by navigating without it
    const url = new URL(window.location.href)
    url.searchParams.delete('add')
    window.history.replaceState(null, '', url.toString())
  }, [addParam, addColumn])

  // Roundtable mode: auto-populate subagent sessions as columns
  const { data: sessions } = useQuery({
    queryKey: chatQueryKeys.sessions,
    queryFn: fetchSessions,
    refetchInterval: 30_000,
    enabled: mode === 'roundtable',
  })

  useEffect(() => {
    if (mode !== 'roundtable' || !sessions) return
    // Add main session as column 0 if not present
    const hasMain = columns.some(
      (c) => c.sessionKey === 'main' || c.sessionKey === 'agent:main:main',
    )
    if (!hasMain) {
      addColumn('main', 'Main')
    }
    // Add subagent sessions
    const subagents = sessions.filter((s) => s.kind === 'subagent')
    for (const s of subagents) {
      const alreadyAdded = columns.some((c) => c.sessionKey === s.key)
      if (!alreadyAdded) {
        const label = s.label || s.title || s.derivedTitle || s.friendlyId
        addColumn(s.key, label)
      }
    }
  }, [mode, sessions, columns, addColumn])

  // SSE connection per column
  useEffect(() => {
    const activeIds = new Set(columns.map((c) => c.id))

    // Close removed columns
    for (const [id, es] of eventSourceRefs.current) {
      if (!activeIds.has(id)) {
        es.close()
        eventSourceRefs.current.delete(id)
      }
    }

    // Open new connections
    for (const col of columns) {
      if (eventSourceRefs.current.has(col.id)) continue
      const es = new EventSource(
        `/api/stream?sessionKey=${encodeURIComponent(col.sessionKey)}`,
      )
      eventSourceRefs.current.set(col.id, es)

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          handleGatewayEvent(parsed, useDeckStore.getState().columns, store())
        } catch {
          // Ignore parse errors
        }
      }

      es.onerror = () => {
        store().setColumnStatus(col.id, 'disconnected')
      }
    }

    return () => {
      // Cleanup on unmount
      for (const es of eventSourceRefs.current.values()) {
        es.close()
      }
      eventSourceRefs.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.map((c) => c.id).join(',')])

  const handleSend = useCallback(
    async (columnId: string, text: string) => {
      const col = columns.find((c) => c.id === columnId)
      if (!col) return

      // Optimistic user message
      useDeckStore.getState().startUserMessage(columnId, text)

      try {
        await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionKey: col.sessionKey, message: text }),
        })
      } catch {
        useDeckStore.getState().setColumnStatus(columnId, 'error')
      }
    },
    [columns],
  )

  return (
    <div className="h-full flex flex-col min-h-0">
      <DeckHeader onAddColumn={() => setAddDialogOpen(true)} />

      <div className="flex-1 min-h-0 flex overflow-x-auto gap-px bg-primary-200">
        {mode === 'triage' ? (
          <TriageView />
        ) : columns.length === 0 ? (
          <DeckEmptyState onAdd={() => setAddDialogOpen(true)} />
        ) : (
          columns.map((col, i) => (
            <AgentColumn
              key={col.id}
              columnId={col.id}
              columnIndex={i}
              onSend={handleSend}
            />
          ))
        )}
      </div>

      <ColumnAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  )
}

// Triage mode: read-only idea pipeline view
function TriageView() {
  const ideasQuery = useQuery({
    queryKey: ['admin', 'ideas', 'triage'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ideas')
      if (!res.ok) return { issues: [] }
      return (await res.json()) as { issues?: Array<Record<string, unknown>> }
    },
  })

  const issues = ideasQuery.data?.issues ?? []
  const STATUS_GROUPS = ['seed', 'elaborating', 'reviewing'] as const

  return (
    <>
      {STATUS_GROUPS.map((status) => {
        const group = issues.filter(
          (i) => String(i.status ?? '').toLowerCase() === status,
        )
        return (
          <div
            key={status}
            className="flex flex-col min-w-[300px] flex-1 bg-surface border-r border-primary-200 last:border-r-0"
          >
            <div className="shrink-0 px-3 py-2 border-b border-primary-100 bg-primary-50/50 flex items-center gap-2">
              <span className="text-xs font-semibold text-primary-700 capitalize">
                {status}
              </span>
              <span className="text-[10px] text-primary-400 bg-primary-200 rounded-full px-1.5">
                {group.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {group.map((idea, i) => (
                <a
                  key={String(idea.id ?? i)}
                  href={`/admin/ideas`}
                  className="block rounded-md border border-primary-200 bg-surface p-3 hover:bg-primary-50 transition-colors"
                >
                  <div className="text-xs font-medium text-primary-900 line-clamp-2">
                    {String(idea.title ?? 'Untitled')}
                  </div>
                  <div className="text-[10px] text-primary-400 mt-1 capitalize">
                    {String(idea.status ?? status)}
                  </div>
                </a>
              ))}
              {group.length === 0 ? (
                <div className="text-xs text-primary-400 text-center py-4">
                  No ideas in {status}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </>
  )
}
