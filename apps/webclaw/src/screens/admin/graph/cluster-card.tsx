import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useClusterDetail } from './graph-queries'
import { ENTITY_COLORS } from './graph-types'
import type { ClusterSummary } from './graph-types'

type ClusterCardProps = {
  cluster: ClusterSummary
  onNavigateToEntity: (entityId: string) => void
}

export function ClusterCard({ cluster, onNavigateToEntity }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false)
  const detail = useClusterDetail(cluster.id, expanded)

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50">
      <button
        type="button"
        onClick={function toggle() {
          setExpanded(!expanded)
        }}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-primary-900">{cluster.name || 'Unnamed cluster'}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-primary-500">
            <span className="tabular-nums">Score: {cluster.score.toFixed(1)}</span>
            {cluster.signalCount ? (
              <span className="tabular-nums">Signals: {cluster.signalCount}</span>
            ) : null}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5',
                cluster.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-primary-200 text-primary-600',
              )}
            >
              {cluster.status}
            </span>
          </div>
        </div>
        <svg
          className={cn('h-4 w-4 text-primary-400 transition-transform', expanded && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-primary-200 p-4">
          {detail.isLoading && (
            <p className="text-xs text-primary-400">Loading...</p>
          )}
          {detail.data && (
            <div className="space-y-3">
              {/* Entities */}
              {detail.data.entities.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium text-primary-500">Entities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.data.entities.map(function renderEntity(entity) {
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          onClick={function navigate() {
                            onNavigateToEntity(entity.id)
                          }}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:opacity-80"
                          style={{
                            backgroundColor: (ENTITY_COLORS[entity.label] ?? '#6b7280') + '20',
                            color: ENTITY_COLORS[entity.label] ?? '#6b7280',
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: ENTITY_COLORS[entity.label] ?? '#6b7280' }}
                          />
                          {entity.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Signals */}
              {detail.data.signals.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium text-primary-500">Signals</h4>
                  <div className="space-y-1.5">
                    {detail.data.signals.map(function renderSignal(signal) {
                      return (
                        <div key={signal.id} className="rounded bg-primary-100 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary-700">{signal.source}</span>
                            {signal.captured_at && (
                              <span className="text-primary-400">
                                {new Date(Number(signal.captured_at) * 1000).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-pretty text-primary-600">
                            {signal.digest || signal.title}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
