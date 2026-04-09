import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import type { GraphCanvasHandle } from '@/screens/admin/graph/graph-canvas'
import type { GraphData, GraphNode } from '@/screens/admin/graph/graph-types'
import { cn } from '@/lib/utils'
import {
  useGraphData,
  useGraphOverview,
} from '@/screens/admin/graph/graph-queries'
import { GraphCanvas } from '@/screens/admin/graph/graph-canvas'
import { GraphToolbar } from '@/screens/admin/graph/graph-toolbar'
import { NodeDetailPanel } from '@/screens/admin/graph/node-detail-panel'
import { ClusterList } from '@/screens/admin/graph/cluster-list'

export const Route = createFileRoute('/admin/graph')({
  component: GraphPage,
})

function GraphPage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'clusters'>('graph')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set())
  const [depth, setDepth] = useState(1)
  const [pendingCenter, setPendingCenter] = useState<string | null>(null)
  const canvasRef = useRef<GraphCanvasHandle>(null)

  const overview = useGraphOverview()
  const graphData = useGraphData()

  const handleNodeClick = useCallback(function handleNodeClick(
    node: GraphNode | null,
  ) {
    setSelectedNode(node)
  }, [])

  const handleNodeExpand = useCallback(
    async function handleNodeExpand(nodeId: string) {
      const query = new URLSearchParams({
        section: 'neighbors',
        id: nodeId,
        depth: String(depth),
      })
      const res = await fetch(`/api/admin/graph?${query}`)
      if (!res.ok) return
      const data = (await res.json()) as { ok: boolean } & GraphData
      if (data.ok && canvasRef.current) {
        canvasRef.current.mergeData(data)
      }
    },
    [depth],
  )

  function handleToggleLabel(label: string) {
    setHiddenLabels(function toggle(prev) {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  function handleSelectSearchResult(node: GraphNode) {
    setActiveTab('graph')
    setPendingCenter(node.id)
    setSelectedNode(node)
  }

  function handleNavigateToEntity(entityId: string) {
    setActiveTab('graph')
    setPendingCenter(entityId)
  }

  function handleNavigateToNode(nodeId: string) {
    setPendingCenter(nodeId)
  }

  const handleCenterComplete = useCallback(function handleCenterComplete() {
    setPendingCenter(null)
  }, [])

  // Derive neighbors from graph data for the detail panel
  const neighbors =
    selectedNode && graphData.data
      ? graphData.data.edges
          .filter(function isConnected(e) {
            return e.source === selectedNode.id || e.target === selectedNode.id
          })
          .map(function toNeighbor(e) {
            const otherId = e.source === selectedNode.id ? e.target : e.source
            const otherNode = graphData.data.nodes.find(function match(n) {
              return n.id === otherId
            })
            return {
              id: otherId,
              name: otherNode?.name ?? otherId,
              label: otherNode?.label ?? 'Unknown',
              relationship: e.type,
            }
          })
      : []

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-balance text-lg font-medium text-primary-900">
          Knowledge Graph
        </h1>
        <p className="text-pretty text-sm text-primary-500">
          Explore entities, relationships, and clusters from your knowledge
          graph
        </p>
      </div>

      {/* Overview stats */}
      {overview.data && (
        <div className="flex gap-4">
          {Object.entries(overview.data.nodeCounts).map(function renderStat([
            label,
            count,
          ]) {
            return (
              <div key={label} className="rounded-lg bg-primary-100 px-3 py-2">
                <div className="text-lg font-medium tabular-nums text-primary-900">
                  {count}
                </div>
                <div className="text-xs text-primary-500">{label}s</div>
              </div>
            )
          })}
          <div className="rounded-lg bg-primary-100 px-3 py-2">
            <div className="text-lg font-medium tabular-nums text-primary-900">
              {overview.data.edgeCount}
            </div>
            <div className="text-xs text-primary-500">Edges</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary-200">
        {(['graph', 'clusters'] as const).map(function renderTab(tab) {
          return (
            <button
              key={tab}
              type="button"
              onClick={function selectTab() {
                setActiveTab(tab)
              }}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-primary-900 text-primary-900'
                  : 'border-transparent text-primary-500 hover:text-primary-700',
              )}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'graph' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <GraphToolbar
            hiddenLabels={hiddenLabels}
            onToggleLabel={handleToggleLabel}
            depth={depth}
            onDepthChange={setDepth}
            onSelectSearchResult={handleSelectSearchResult}
          />
          <div className="flex min-h-0 flex-1 gap-0">
            <GraphCanvas
              ref={canvasRef}
              data={graphData.data}
              selectedNode={selectedNode?.id ?? null}
              onNodeClick={handleNodeClick}
              onNodeExpand={handleNodeExpand}
              hiddenLabels={hiddenLabels}
              pendingCenter={pendingCenter}
              onCenterComplete={handleCenterComplete}
            />
            <NodeDetailPanel
              node={selectedNode}
              neighbors={neighbors}
              onClose={function close() {
                setSelectedNode(null)
              }}
              onExpand={handleNodeExpand}
              onNavigateToNode={handleNavigateToNode}
            />
          </div>
        </div>
      )}

      {activeTab === 'clusters' && (
        <ClusterList onNavigateToEntity={handleNavigateToEntity} />
      )}
    </div>
  )
}
