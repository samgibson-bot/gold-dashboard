import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DeckColumn,
  DeckColumnStatus,
  DeckMessage,
  DeckMode,
} from './types'
import { randomUUID } from '@/lib/utils'

export const COLUMN_ACCENTS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#f59e0b',
  '#ef4444',
]

type DeckStore = {
  columns: Array<DeckColumn>
  mode: DeckMode

  addColumn: (sessionKey: string, label: string) => void
  removeColumn: (id: string) => void
  reorderColumns: (fromIndex: number, toIndex: number) => void
  setMode: (mode: DeckMode) => void

  // Event handlers called by DeckScreen's SSE listeners
  appendDelta: (columnId: string, delta: string) => void
  finalizeMessage: (columnId: string) => void
  setColumnStatus: (columnId: string, status: DeckColumnStatus) => void
  setColumnModel: (columnId: string, model: string) => void
  updateColumnUsage: (
    columnId: string,
    totalTokens: number,
    contextTokens?: number,
  ) => void
  setColumnFailover: (
    columnId: string,
    failover: DeckColumn['failover'],
  ) => void
  appendCompaction: (columnId: string, data: DeckMessage['compaction']) => void
  startUserMessage: (columnId: string, text: string) => void
}

function makeColumn(
  sessionKey: string,
  label: string,
  index: number,
): DeckColumn {
  const id = `col-${Date.now()}-${index}`
  return {
    id,
    sessionKey: sessionKey || `agent:main:${id}`,
    label: label || `Column ${index + 1}`,
    accent: COLUMN_ACCENTS[index % COLUMN_ACCENTS.length],
    status: 'idle',
    messages: [],
    totalTokens: 0,
  }
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      columns: [],
      mode: 'free',

      addColumn: (sessionKey, label) => {
        const { columns } = get()
        // Don't add duplicate session keys
        if (sessionKey && columns.some((c) => c.sessionKey === sessionKey))
          return
        const col = makeColumn(sessionKey, label, columns.length)
        set({ columns: [...columns, col] })
      },

      removeColumn: (id) => {
        set((state) => ({ columns: state.columns.filter((c) => c.id !== id) }))
      },

      reorderColumns: (fromIndex, toIndex) => {
        set((state) => {
          const cols = [...state.columns]
          const [moved] = cols.splice(fromIndex, 1)
          cols.splice(toIndex, 0, moved)
          return { columns: cols }
        })
      },

      setMode: (mode) => set({ mode }),

      appendDelta: (columnId, delta) => {
        set((state) => ({
          columns: state.columns.map((col) => {
            if (col.id !== columnId) return col
            const messages = [...col.messages]
            const last = messages[messages.length - 1]
            if (last && last.role === 'assistant' && last.streaming) {
              messages[messages.length - 1] = {
                ...last,
                text: last.text + delta,
              }
            } else {
              messages.push({
                id: randomUUID(),
                role: 'assistant',
                text: delta,
                timestamp: Date.now(),
                streaming: true,
              })
            }
            return { ...col, messages, status: 'streaming' as DeckColumnStatus }
          }),
        }))
      },

      finalizeMessage: (columnId) => {
        set((state) => ({
          columns: state.columns.map((col) => {
            if (col.id !== columnId) return col
            const messages = col.messages.map((m) =>
              m.streaming ? { ...m, streaming: false } : m,
            )
            return { ...col, messages, status: 'idle' as DeckColumnStatus }
          }),
        }))
      },

      setColumnStatus: (columnId, status) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, status } : col,
          ),
        }))
      },

      setColumnModel: (columnId, model) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, model } : col,
          ),
        }))
      },

      updateColumnUsage: (columnId, totalTokens, contextTokens) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, totalTokens, contextTokens } : col,
          ),
        }))
      },

      setColumnFailover: (columnId, failover) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, failover } : col,
          ),
        }))
      },

      appendCompaction: (columnId, data) => {
        if (!data) return
        set((state) => ({
          columns: state.columns.map((col) => {
            if (col.id !== columnId) return col
            const msg: DeckMessage = {
              id: randomUUID(),
              role: 'system',
              text: `Context compacted: ${data.droppedMessages} messages dropped, ${data.beforeTokens.toLocaleString()} → ${data.afterTokens.toLocaleString()} tokens`,
              timestamp: Date.now(),
              compaction: data,
            }
            return { ...col, messages: [...col.messages, msg] }
          }),
        }))
      },

      startUserMessage: (columnId, text) => {
        set((state) => ({
          columns: state.columns.map((col) => {
            if (col.id !== columnId) return col
            const msg: DeckMessage = {
              id: randomUUID(),
              role: 'user',
              text,
              timestamp: Date.now(),
            }
            return {
              ...col,
              messages: [...col.messages, msg],
              status: 'streaming' as DeckColumnStatus,
            }
          }),
        }))
      },
    }),
    {
      name: 'deck-columns',
      // Only persist column config (not messages)
      partialize: (state) => ({
        columns: state.columns.map((col) => ({
          ...col,
          messages: [],
          status: 'disconnected' as DeckColumnStatus,
        })),
        mode: state.mode,
      }),
    },
  ),
)
