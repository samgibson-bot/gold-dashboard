'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { useStickToBottom } from 'use-stick-to-bottom'
import { useDeckStore } from '../deck-store'
import { ContextMeter } from '@/screens/chat/components/context-meter'
import { cn } from '@/lib/utils'
import type { DeckColumn, DeckColumnStatus } from '../types'

type AgentColumnProps = {
  columnId: string
  columnIndex: number
  onSend: (columnId: string, text: string) => void
}

function StatusBadge({ status }: { status: DeckColumnStatus }) {
  const isActive =
    status === 'streaming' || status === 'thinking' || status === 'tool_use'

  if (status === 'idle' || status === 'disconnected') return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
        status === 'streaming' && 'bg-blue-100 text-blue-700',
        status === 'thinking' && 'bg-purple-100 text-purple-700',
        status === 'tool_use' && 'bg-amber-100 text-amber-700',
        status === 'error' && 'bg-red-100 text-red-700',
      )}
    >
      {isActive ? (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      ) : null}
      {status}
    </span>
  )
}

export function AgentColumn({ columnId, columnIndex, onSend }: AgentColumnProps) {
  const column = useDeckStore(
    (s) => s.columns.find((c) => c.id === columnId) as DeckColumn | undefined,
  )
  const removeColumn = useDeckStore((s) => s.removeColumn)
  const [inputValue, setInputValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { scrollRef, contentRef } = useStickToBottom()

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || !column) return
    onSend(columnId, text)
    setInputValue('')
  }, [columnId, inputValue, onSend, column])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // Double-click delete confirmation
  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      removeColumn(columnId)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 2000)
    }
  }, [columnId, confirmDelete, removeColumn])

  // Keyboard shortcut focus: Cmd+{index+1}
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === String(columnIndex + 1)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [columnIndex])

  if (!column) return null

  return (
    <div
      className="flex flex-col min-w-[300px] max-w-[480px] flex-1 bg-surface border-r border-primary-200 last:border-r-0"
      style={{ borderTopColor: column.accent, borderTopWidth: 2 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary-100 bg-primary-50/50 shrink-0">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ backgroundColor: column.accent }}
        >
          {columnIndex + 1}
        </span>
        <span className="text-sm font-medium text-primary-900 flex-1 min-w-0 truncate">
          {column.label}
        </span>
        {column.model ? (
          <span className="text-[10px] opacity-50 truncate max-w-[80px]">
            {column.model.split('/').pop()}
          </span>
        ) : null}
        <StatusBadge status={column.status} />
        {column.contextTokens ? (
          <ContextMeter
            totalTokens={column.totalTokens}
            contextTokens={column.contextTokens}
            className="shrink-0"
          />
        ) : null}
        {column.failover ? (
          <span className="text-[10px] text-amber-600 shrink-0">
            ↔ {column.failover.to.split('/').pop()}
          </span>
        ) : null}
        <button
          onClick={handleDeleteClick}
          title={confirmDelete ? 'Click again to confirm delete' : 'Remove column (double-click)'}
          className={cn(
            'text-[10px] p-1 rounded transition-colors',
            confirmDelete
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'text-primary-400 hover:text-primary-600 hover:bg-primary-100',
          )}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div ref={contentRef} className="flex flex-col gap-3 p-3">
          {column.messages.length === 0 ? (
            <div className="text-xs text-primary-400 text-center py-8">
              No messages yet
            </div>
          ) : null}
          {column.messages.map((msg) => {
            if (msg.compaction) {
              return (
                <div
                  key={msg.id}
                  className="text-[10px] text-primary-400 border-t border-dashed border-primary-200 pt-2 text-center"
                >
                  {msg.text}
                </div>
              )
            }
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-primary-900 text-white text-xs rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {msg.text}
                  </div>
                </div>
              )
            }
            return (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="text-xs text-primary-800 whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                  {msg.streaming ? (
                    <span className="inline-block w-[2px] h-4 bg-current animate-pulse ml-0.5 align-middle" />
                  ) : null}
                </div>
                {msg.toolUse ? (
                  <div
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded w-fit',
                      msg.toolUse.status === 'running'
                        ? 'bg-amber-50 text-amber-600 animate-pulse'
                        : msg.toolUse.status === 'done'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-600',
                    )}
                  >
                    ⚙ {msg.toolUse.name}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-primary-100 p-2">
        <div className="flex gap-1.5">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${column.label}…`}
            rows={1}
            data-deck-input={columnIndex}
            className="flex-1 text-xs bg-primary-50 border border-primary-200 rounded-md px-2.5 py-1.5 resize-none outline-none focus:border-primary-400 transition-colors placeholder:text-primary-400"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="shrink-0 text-xs px-2.5 py-1.5 rounded-md font-medium bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
