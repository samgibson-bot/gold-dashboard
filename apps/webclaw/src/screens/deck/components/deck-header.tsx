'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon } from '@hugeicons/core-free-icons'
import { useDeckStore } from '../deck-store'
import type { DeckMode } from '../types'
import { cn } from '@/lib/utils'

type DeckHeaderProps = {
  onAddColumn: () => void
}

const MODES: Array<{ value: DeckMode; label: string }> = [
  { value: 'free', label: 'Free' },
  { value: 'roundtable', label: 'Roundtable' },
  { value: 'triage', label: 'Triage' },
]

export function DeckHeader({ onAddColumn }: DeckHeaderProps) {
  const columns = useDeckStore((s) => s.columns)
  const mode = useDeckStore((s) => s.mode)
  const setMode = useDeckStore((s) => s.setMode)

  const streamingCount = columns.filter(
    (c) => c.status === 'streaming' || c.status === 'thinking',
  ).length
  const totalTokens = columns.reduce((sum, c) => sum + c.totalTokens, 0)

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-primary-200 bg-surface">
      {/* Title + mode tabs */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-primary-950">Deck</span>
        <div className="flex gap-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded font-medium transition-colors',
                mode === m.value
                  ? 'bg-primary-900 text-white'
                  : 'text-primary-500 hover:text-primary-700 hover:bg-primary-100',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global stats */}
      <div className="flex-1 flex items-center justify-center gap-3 text-xs text-primary-400">
        {streamingCount > 0 ? (
          <span className="text-blue-600 font-medium">
            {streamingCount} streaming
          </span>
        ) : null}
        {totalTokens > 0 ? (
          <span>{totalTokens.toLocaleString()} tokens</span>
        ) : null}
      </div>

      {/* Add column */}
      <button
        onClick={onAddColumn}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium bg-primary-900 text-white hover:bg-primary-800 transition-colors"
        title="Add Column (⌘1-6 to focus)"
      >
        <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
        Add Column
      </button>
    </div>
  )
}
