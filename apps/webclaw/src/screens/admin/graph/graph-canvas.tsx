import { useCallback, useEffect, useRef, useState } from 'react'
import Graph from 'graphology'
import Sigma from 'sigma'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { cn } from '@/lib/utils'
import type { GraphData, GraphNode } from './graph-types'
import { ENTITY_COLORS } from './graph-types'

type GraphCanvasProps = {
  data: GraphData | undefined
  selectedNode: string | null
  onNodeClick: (node: GraphNode | null) => void
  onNodeExpand: (nodeId: string) => void
  hiddenLabels: Set<string>
  pendingCenter: string | null
  onCenterComplete: () => void
}

export function GraphCanvas({
  data,
  selectedNode,
  onNodeClick,
  onNodeExpand,
  hiddenLabels,
  pendingCenter,
  onCenterComplete,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

  // Initialize graph + sigma
  useEffect(
    function initSigma() {
      if (!containerRef.current || !data) return

      const graph = new Graph()
      graphRef.current = graph

      for (const node of data.nodes) {
        if (!graph.hasNode(node.id)) {
          graph.addNode(node.id, {
            label: node.name,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 6,
            color: ENTITY_COLORS[node.label] ?? '#6b7280',
            nodeLabel: node.label,
            nodeData: node,
          })
        }
      }

      for (const edge of data.edges) {
        if (
          graph.hasNode(edge.source) &&
          graph.hasNode(edge.target) &&
          !graph.hasEdge(edge.source, edge.target)
        ) {
          const sourceLabel = graph.getNodeAttribute(edge.source, 'nodeLabel') as string
          const targetLabel = graph.getNodeAttribute(edge.target, 'nodeLabel') as string
          graph.addEdge(edge.source, edge.target, {
            edgeType: edge.type,
            color: '#d1d5db',
            size: 1,
            sourceLabel,
            targetLabel,
          })
        }
      }

      // Scale node size by degree
      graph.forEachNode(function scaleSize(nodeId) {
        const degree = graph.degree(nodeId)
        graph.setNodeAttribute(nodeId, 'size', Math.max(4, Math.min(20, 4 + degree * 1.5)))
      })

      // Run ForceAtlas2 layout
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 1,
          scalingRatio: 2,
          barnesHutOptimize: graph.order > 100,
        },
      })

      const sigma = new Sigma(graph, containerRef.current, {
        renderLabels: true,
        labelRenderedSizeThreshold: 8,
        defaultEdgeColor: '#d1d5db',
        labelColor: { color: '#374151' },
        // v3 nodeReducer: (node, data) => Partial<NodeDisplayData> — no graph arg
        nodeReducer: function reduceNode(node, attrs) {
          const res = { ...attrs }
          const label = attrs.nodeLabel as string
          if (hiddenLabels.has(label)) {
            res.hidden = true
          }
          if (selectedNode === node) {
            res.highlighted = true
            res.zIndex = 1
          }
          return res
        },
        // v3 edgeReducer: (edge, data) => Partial<EdgeDisplayData> — source/target stored in attrs
        edgeReducer: function reduceEdge(_edge, attrs) {
          const res = { ...attrs }
          const sourceLabel = attrs.sourceLabel as string | undefined
          const targetLabel = attrs.targetLabel as string | undefined
          if (
            (sourceLabel && hiddenLabels.has(sourceLabel)) ||
            (targetLabel && hiddenLabels.has(targetLabel))
          ) {
            res.hidden = true
          }
          return res
        },
      })

      sigma.on('clickNode', function handleClick({ node }) {
        const nodeData = graph.getNodeAttribute(node, 'nodeData') as GraphNode
        onNodeClick(nodeData)
      })

      sigma.on('doubleClickNode', function handleDblClick({ node }) {
        onNodeExpand(node)
      })

      sigma.on('clickStage', function handleStageClick() {
        onNodeClick(null)
      })

      sigmaRef.current = sigma
      setNodeCount(graph.order)
      setEdgeCount(graph.size)

      return function cleanup() {
        sigma.kill()
        sigmaRef.current = null
        graphRef.current = null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  )

  // Update reducers when filters/selection change
  useEffect(
    function refreshReducers() {
      if (sigmaRef.current) {
        sigmaRef.current.refresh()
      }
    },
    [hiddenLabels, selectedNode],
  )

  // Handle pending center (from cluster navigation)
  useEffect(
    function handlePendingCenter() {
      if (!pendingCenter || !sigmaRef.current || !graphRef.current) return
      const graph = graphRef.current
      const sigma = sigmaRef.current

      if (graph.hasNode(pendingCenter)) {
        const x = graph.getNodeAttribute(pendingCenter, 'x') as number
        const y = graph.getNodeAttribute(pendingCenter, 'y') as number
        // sigma v3 camera animates in normalized graph coordinates
        const nodeDisplayData = sigma.getNodeDisplayData(pendingCenter)
        if (nodeDisplayData) {
          sigma.getCamera().animate(
            { x: nodeDisplayData.x, y: nodeDisplayData.y, ratio: 0.3 },
            { duration: 600 },
          )
        } else {
          sigma.getCamera().animate({ x, y, ratio: 0.3 }, { duration: 600 })
        }
        const nodeData = graph.getNodeAttribute(pendingCenter, 'nodeData') as GraphNode
        onNodeClick(nodeData)
      }
      onCenterComplete()
    },
    [pendingCenter, onCenterComplete, onNodeClick],
  )

  // Merge new nodes/edges (for neighbor expansion)
  const mergeData = useCallback(function mergeData(newData: GraphData) {
    const graph = graphRef.current
    if (!graph) return

    for (const node of newData.nodes) {
      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id, {
          label: node.name,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 6,
          color: ENTITY_COLORS[node.label] ?? '#6b7280',
          nodeLabel: node.label,
          nodeData: node,
        })
      }
    }

    for (const edge of newData.edges) {
      if (
        graph.hasNode(edge.source) &&
        graph.hasNode(edge.target) &&
        !graph.hasEdge(edge.source, edge.target)
      ) {
        const sourceLabel = graph.getNodeAttribute(edge.source, 'nodeLabel') as string
        const targetLabel = graph.getNodeAttribute(edge.target, 'nodeLabel') as string
        graph.addEdge(edge.source, edge.target, {
          edgeType: edge.type,
          color: '#d1d5db',
          size: 1,
          sourceLabel,
          targetLabel,
        })
      }
    }

    // Re-scale sizes
    graph.forEachNode(function scaleSize(nodeId) {
      const degree = graph.degree(nodeId)
      graph.setNodeAttribute(nodeId, 'size', Math.max(4, Math.min(20, 4 + degree * 1.5)))
    })

    // Brief re-layout
    forceAtlas2.assign(graph, {
      iterations: 50,
      settings: { gravity: 1, scalingRatio: 2, barnesHutOptimize: true },
    })

    setNodeCount(graph.order)
    setEdgeCount(graph.size)
  }, [])

  // Expose mergeData for parent use (will be wired via forwardRef in a later task)
  void mergeData

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className={cn('h-full w-full bg-primary-50 rounded-lg')} />
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-primary-500 tabular-nums">
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges</span>
      </div>
    </div>
  )
}
