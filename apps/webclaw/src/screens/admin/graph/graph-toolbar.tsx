import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useGraphSearch } from './graph-queries'
import { ENTITY_COLORS, ENTITY_LABELS } from './graph-types'
import type { GraphNode } from './graph-types'

type GraphToolbarProps = {
  hiddenLabels: Set<string>
  onToggleLabel: (label: string) => void
  depth: number
  onDepthChange: (depth: number) => void
  onSelectSearchResult: (node: GraphNode) => void
}

export function GraphToolbar({
  hiddenLabels,
  onToggleLabel,
  depth,
  onDepthChange,
  onSelectSearchResult,
}: GraphToolbarProps) {
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(
    function debounceSearch() {
      const timer = setTimeout(function apply() {
        setDebouncedSearch(searchText)
      }, 300)
      return function cancel() {
        clearTimeout(timer)
      }
    },
    [searchText],
  )

  useEffect(
    function handleClickOutside() {
      function onClickOutside(e: MouseEvent) {
        if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
          setShowResults(false)
        }
      }
      document.addEventListener('mousedown', onClickOutside)
      return function cleanup() {
        document.removeEventListener('mousedown', onClickOutside)
      }
    },
    [],
  )

  const searchResults = useGraphSearch(debouncedSearch)

  function handleSelectResult(node: GraphNode) {
    onSelectSearchResult(node)
    setShowResults(false)
    setSearchText('')
    setDebouncedSearch('')
  }

  return (
    <div className="flex items-center gap-4 rounded-lg bg-primary-100 p-3">
      {/* Search */}
      <div ref={searchRef} className="relative min-w-48">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchText}
          onChange={function onInput(e) {
            setSearchText(e.target.value)
            setShowResults(true)
          }}
          onFocus={function onFocus() {
            if (debouncedSearch.length >= 2) setShowResults(true)
          }}
          className="w-full rounded-md border border-primary-300 bg-primary-50 px-3 py-1.5 text-sm text-primary-900 placeholder:text-primary-400 focus:border-primary-500 focus:outline-none"
        />
        {showResults && searchResults.data && searchResults.data.length > 0 && (
          <div className="absolute top-full z-50 mt-1 max-h-60 w-72 overflow-y-auto rounded-md border border-primary-300 bg-primary-50 shadow-lg">
            {searchResults.data.map(function renderResult(node) {
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={function select() {
                    handleSelectResult(node)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-200"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ENTITY_COLORS[node.label] ?? '#6b7280' }}
                  />
                  <span className="truncate text-primary-900">{node.name}</span>
                  <span className="ml-auto text-xs text-primary-500">{node.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {ENTITY_LABELS.map(function renderPill(label) {
          const active = !hiddenLabels.has(label)
          return (
            <button
              key={label}
              type="button"
              onClick={function toggle() {
                onToggleLabel(label)
              }}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity',
                active ? 'opacity-100' : 'opacity-40',
              )}
              style={{
                backgroundColor: active
                  ? ENTITY_COLORS[label] + '20'
                  : undefined,
                color: ENTITY_COLORS[label],
                border: `1px solid ${ENTITY_COLORS[label]}40`,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Depth selector */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-primary-500">Depth</span>
        {[1, 2, 3].map(function renderDepth(d) {
          return (
            <button
              key={d}
              type="button"
              onClick={function select() {
                onDepthChange(d)
              }}
              className={cn(
                'h-7 w-7 rounded text-xs font-medium',
                d === depth
                  ? 'bg-primary-900 text-primary-50'
                  : 'bg-primary-200 text-primary-600 hover:bg-primary-300',
              )}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
