import { ENTITY_COLORS } from './graph-types'
import type { GraphNode } from './graph-types'
import { cn } from '@/lib/utils'

type NodeDetailPanelProps = {
  node: GraphNode | null
  neighbors: Array<{
    id: string
    name: string
    label: string
    relationship: string
  }>
  onClose: () => void
  onExpand: (nodeId: string) => void
  onNavigateToNode: (nodeId: string) => void
  onOpenDetail: () => void
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
])

export function NodeDetailPanel({
  node,
  neighbors,
  onClose,
  onExpand,
  onNavigateToNode,
  onOpenDetail,
}: NodeDetailPanelProps) {
  if (!node) return null

  const displayProps = Object.entries(node.properties).filter(
    function filterProps([key]) {
      return !SKIP_PROPERTIES.has(key)
    },
  )

  return (
    <div className="flex h-full w-72 flex-col border-l border-primary-200 bg-primary-50">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-primary-200 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-balance text-sm font-medium text-primary-900">
            {node.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: ENTITY_COLORS[node.label] ?? '#6b7280',
              }}
            />
            <span className="text-xs text-primary-500">{node.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-primary-400 hover:text-primary-600"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-b border-primary-200 p-3">
        <button
          type="button"
          onClick={onOpenDetail}
          className="w-full rounded-md bg-primary-900 px-3 py-1.5 text-xs font-medium text-primary-50 hover:bg-primary-800"
        >
          View full details
        </button>
        <button
          type="button"
          onClick={function expand() {
            onExpand(node.id)
          }}
          className="w-full rounded-md bg-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-300"
        >
          Expand neighbors
        </button>
      </div>

      {/* Properties */}
      {displayProps.length > 0 && (
        <div className="border-b border-primary-200 p-4">
          <h4 className="mb-2 text-xs font-medium text-primary-500">
            Properties
          </h4>
          <dl className="space-y-1.5">
            {displayProps.map(function renderProp([key, value]) {
              return (
                <div key={key} className="flex gap-2 text-xs">
                  <dt className="shrink-0 text-primary-500">{key}</dt>
                  <dd className="break-words text-pretty text-primary-800">
                    {formatValue(value)}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {/* Connections */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="mb-2 text-xs font-medium text-primary-500">
          Connections ({neighbors.length})
        </h4>
        <div className="space-y-1">
          {neighbors.map(function renderNeighbor(n) {
            return (
              <button
                key={`${n.id}-${n.relationship}`}
                type="button"
                onClick={function navigate() {
                  onNavigateToNode(n.id)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-primary-200"
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: ENTITY_COLORS[n.label] ?? '#6b7280',
                  }}
                />
                <span className="truncate text-primary-800">{n.name}</span>
                <span className="ml-auto shrink-0 text-primary-400">
                  {n.relationship}
                </span>
              </button>
            )
          })}
          {neighbors.length === 0 && (
            <p className="text-xs text-primary-400">No connections found</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}
