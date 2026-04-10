import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ENTITY_COLORS } from './graph-types'
import type { GraphNode } from './graph-types'
import { useNodeDetail } from './graph-queries'

type Neighbor = {
  id: string
  name: string
  label: string
  relationship: string
}

type NodeDetailModalProps = {
  node: GraphNode | null
  neighbors: Array<Neighbor>
  isOpen: boolean
  onClose: () => void
  onNavigateToNode: (nodeId: string) => void
}

const SKIP_PROPERTIES = new Set([
  'id',
  'name',
  'title',
  'label',
  '_label',
  'embedding',
  'nodeLabel',
  'nodeData',
  'description',
])

export function NodeDetailModal({
  node,
  neighbors,
  isOpen,
  onClose,
  onNavigateToNode,
}: NodeDetailModalProps) {
  const detail = useNodeDetail(node?.id ?? null, isOpen)

  useEffect(
    function bindEscape() {
      if (!isOpen) return
      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', onKey)
      return function cleanup() {
        window.removeEventListener('keydown', onKey)
      }
    },
    [isOpen, onClose],
  )

  if (!isOpen || !node) return null

  const description = String(node.properties.description ?? '').trim()
  const displayProps = Object.entries(node.properties).filter(
    function filterProps([key]) {
      return !SKIP_PROPERTIES.has(key)
    },
  )

  const weights = detail.data?.connectionWeights ?? {}
  const weightedNeighbors = [...neighbors]
    .map(function withWeight(n) {
      return { ...n, weight: weights[n.id] ?? 0 }
    })
    .sort(function byWeight(a, b) {
      return b.weight - a.weight
    })

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="node-detail-title"
    >
      <div
        className="flex max-h-[85vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-lg border border-primary-200 bg-primary-50 shadow-xl"
        onClick={function stop(e) {
          e.stopPropagation()
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-primary-200 p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: ENTITY_COLORS[node.label] ?? '#6b7280',
                }}
              />
              <span className="text-xs uppercase tracking-wide text-primary-500">
                {node.label}
              </span>
            </div>
            <h2
              id="node-detail-title"
              className="text-balance text-lg font-medium text-primary-900"
            >
              {node.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="ml-3 shrink-0 text-primary-400 hover:text-primary-700"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          {description && (
            <section className="border-b border-primary-200 p-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-500">
                Description
              </h3>
              <p className="max-w-prose text-pretty text-sm text-primary-900">
                {description}
              </p>
            </section>
          )}

          {/* Properties */}
          {displayProps.length > 0 && (
            <section className="border-b border-primary-200 p-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-500">
                Properties
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {displayProps.map(function renderProp([key, value]) {
                  return (
                    <div key={key} className="contents">
                      <dt className="text-primary-500">{key}</dt>
                      <dd className="break-words text-pretty text-primary-900">
                        {formatValue(value)}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>
          )}

          {/* Source signals */}
          <section className="border-b border-primary-200 p-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-primary-500">
              Source signals{' '}
              {detail.data ? `(${detail.data.signals.length})` : ''}
            </h3>
            {detail.isLoading && <SkeletonList />}
            {detail.isError && (
              <ErrorBlock
                onRetry={function retry() {
                  void detail.refetch()
                }}
              />
            )}
            {detail.data && detail.data.signals.length === 0 && (
              <p className="text-sm text-primary-500">
                No source signals found for this entity.
              </p>
            )}
            {detail.data && detail.data.signals.length > 0 && (
              <ul className="space-y-3">
                {detail.data.signals.map(function renderSignal(s) {
                  return (
                    <li
                      key={s.id}
                      className="rounded-md border border-primary-200 bg-primary-100 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-primary-500">
                        <span className="font-medium text-primary-600">
                          {s.source || 'unknown'}
                        </span>
                        {s.captured_at && (
                          <>
                            <span>·</span>
                            <span className="tabular-nums">
                              {formatDate(s.captured_at)}
                            </span>
                          </>
                        )}
                      </div>
                      {s.title && (
                        <div className="mb-1 text-sm font-medium text-primary-900">
                          {s.title}
                        </div>
                      )}
                      {s.digest && (
                        <p className="text-pretty text-sm text-primary-800">
                          {s.digest}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Clusters */}
          {detail.data && detail.data.clusters.length > 0 && (
            <section className="border-b border-primary-200 p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-primary-500">
                Clusters ({detail.data.clusters.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {detail.data.clusters.map(function renderCluster(c) {
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-full bg-primary-200 px-3 py-1 text-xs text-primary-800"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: ENTITY_COLORS.Cluster }}
                      />
                      <span>{c.name}</span>
                      <span className="tabular-nums text-primary-500">
                        {c.score.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Connections */}
          <section className="p-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-primary-500">
              Connections ({weightedNeighbors.length})
            </h3>
            {weightedNeighbors.length === 0 && (
              <p className="text-sm text-primary-500">No connections found.</p>
            )}
            <ul className="space-y-1">
              {weightedNeighbors.map(function renderNeighbor(n) {
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={function navigate() {
                        onNavigateToNode(n.id)
                        onClose()
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-primary-200"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: ENTITY_COLORS[n.label] ?? '#6b7280',
                        }}
                      />
                      <span className="flex-1 text-primary-900">{n.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-primary-500">
                        {n.weight > 0
                          ? `${n.weight} signal${n.weight === 1 ? '' : 's'}`
                          : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map(function renderSkeleton(i) {
        return (
          <li
            key={i}
            className="h-20 animate-pulse rounded-md border border-primary-200 bg-primary-100"
          />
        )
      })}
    </ul>
  )
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-md border border-primary-200 bg-primary-100 p-3 text-sm">
      <p className="mb-2 text-primary-700">Failed to load node details.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-primary-200 px-3 py-1 text-xs font-medium text-primary-800 hover:bg-primary-300"
      >
        Retry
      </button>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
