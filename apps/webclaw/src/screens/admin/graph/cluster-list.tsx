import { useState } from 'react'
import { useGraphClusters } from './graph-queries'
import { ClusterCard } from './cluster-card'

type ClusterListProps = {
  onNavigateToEntity: (entityId: string) => void
}

export function ClusterList({ onNavigateToEntity }: ClusterListProps) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [minScore, setMinScore] = useState(0)
  const [sortBy, setSortBy] = useState<'score' | 'signals'>('score')

  const clustersQuery = useGraphClusters(statusFilter, minScore)
  const clusters = clustersQuery.data ?? []

  const sorted = [...clusters].sort(function compare(a, b) {
    if (sortBy === 'signals') return (b.signalCount ?? 0) - (a.signalCount ?? 0)
    return b.score - a.score
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg bg-primary-100 p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-primary-500">Status</label>
          <select
            value={statusFilter}
            onChange={function onSelect(e) {
              setStatusFilter(e.target.value)
            }}
            className="rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-800"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="crystallized">Crystallized</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-primary-500">Min score</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={minScore}
            onChange={function onInput(e) {
              setMinScore(Number(e.target.value))
            }}
            className="w-16 rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-800 tabular-nums"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-primary-500">Sort</label>
          <select
            value={sortBy}
            onChange={function onSelect(e) {
              setSortBy(e.target.value as 'score' | 'signals')
            }}
            className="rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-800"
          >
            <option value="score">Score</option>
            <option value="signals">Signals</option>
          </select>
        </div>
      </div>

      {/* List */}
      {clustersQuery.isLoading && (
        <p className="py-8 text-center text-sm text-primary-400">Loading clusters...</p>
      )}
      {!clustersQuery.isLoading && sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-primary-400">No clusters found</p>
      )}
      <div className="space-y-3">
        {sorted.map(function renderCluster(cluster) {
          return (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              onNavigateToEntity={onNavigateToEntity}
            />
          )
        })}
      </div>
    </div>
  )
}
