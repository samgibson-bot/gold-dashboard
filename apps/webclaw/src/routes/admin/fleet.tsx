import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FleetAgent, FleetStatus, McpServer } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import { StatusCard } from '@/components/ui/status-card'
import { describeCronSchedule, formatRelativeTime } from '@/lib/format'

const COST_TIER_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  standard: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-primary-200 text-primary-600',
  active: 'bg-green-100 text-green-700',
  spawned: 'bg-blue-100 text-blue-700',
}

export const Route = createFileRoute('/admin/fleet')({
  component: FleetPage,
})

function McpServersPanel() {
  const [expanded, setExpanded] = useState(false)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  const mcpQuery = useQuery({
    queryKey: ['admin', 'fleet', 'mcp'],
    queryFn: async function fetchMcp() {
      const res = await fetch('/api/admin/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_mcp' }),
      })
      if (!res.ok) return { ok: true, mcp: [] }
      return (await res.json()) as { ok: boolean; mcp: Array<McpServer> }
    },
    staleTime: 60_000,
  })

  const servers = mcpQuery.data?.mcp ?? []

  return (
    <div>
      <button
        onClick={function handleToggle() {
          setExpanded(function toggle(v) {
            return !v
          })
        }}
        className="w-full flex items-center justify-between text-sm font-medium text-primary-900 mb-3 hover:text-primary-700 transition-colors"
      >
        <span>MCP Servers</span>
        <span className="text-xs text-primary-400">
          {expanded ? '▲' : '▼'} {servers.length} server
          {servers.length !== 1 ? 's' : ''}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2">
          {mcpQuery.isLoading ? (
            <div className="text-xs text-primary-400 py-2">
              Loading MCP servers...
            </div>
          ) : servers.length === 0 ? (
            <div className="text-xs text-primary-400 py-2">
              No MCP servers connected
            </div>
          ) : (
            servers.map(function renderServer(server) {
              const isServerExpanded = expandedServer === server.name
              return (
                <div
                  key={server.name}
                  className="rounded-lg border border-primary-200 bg-surface overflow-hidden"
                >
                  <button
                    onClick={function handleServerToggle() {
                      setExpandedServer(function toggle(v) {
                        return v === server.name ? null : server.name
                      })
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-primary-50 transition-colors"
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        server.status === 'connected'
                          ? 'bg-green-500'
                          : 'bg-red-400',
                      )}
                    />
                    <span className="text-sm font-medium text-primary-900 flex-1">
                      {server.name}
                    </span>
                    <span className="text-xs text-primary-400">
                      {server.tools?.length ?? 0} tools
                    </span>
                    <span className="text-xs text-primary-400">
                      {isServerExpanded ? '▲' : '▼'}
                    </span>
                  </button>
                  {isServerExpanded &&
                    server.tools &&
                    server.tools.length > 0 && (
                      <div className="border-t border-primary-100 px-4 py-2 space-y-1">
                        {server.tools.map(function renderTool(tool) {
                          return (
                            <div
                              key={tool.name}
                              className="flex items-start gap-2 py-1"
                            >
                              <code className="text-[10px] text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded font-mono shrink-0">
                                {tool.name}
                              </code>
                              {tool.description && (
                                <span className="text-xs text-primary-500 leading-relaxed">
                                  {tool.description}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function FleetPage() {
  const queryClient = useQueryClient()
  const [expandedSouls, setExpandedSouls] = useState<Record<string, string>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.fleet,
    queryFn: async function fetchFleet() {
      const res = await fetch('/api/admin/fleet')
      if (!res.ok) throw new Error('Failed to fetch fleet')
      return (await res.json()) as FleetStatus
    },
    refetchInterval: 15_000,
  })

  const spawnMutation = useMutation({
    mutationFn: async function spawnAgent(agentId: string) {
      const res = await fetch('/api/admin/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spawn', agent_id: agentId }),
      })
      if (!res.ok) throw new Error('Failed to spawn agent')
      return res.json()
    },
    onSuccess: function onSpawnSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.fleet })
    },
  })

  const viewSoulMutation = useMutation({
    mutationFn: async function readSoul(soulPath: string) {
      const res = await fetch('/api/admin/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_soul', soul_path: soulPath }),
      })
      if (!res.ok) throw new Error('Failed to read soul')
      return (await res.json()) as { ok: boolean; content: string }
    },
  })

  function handleToggleSoul(agent: FleetAgent) {
    if (expandedSouls[agent.id]) {
      setExpandedSouls(function collapse(prev) {
        const next = { ...prev }
        delete next[agent.id]
        return next
      })
    } else {
      viewSoulMutation.mutate(agent.soul, {
        onSuccess: function onRead(result) {
          setExpandedSouls(function expand(prev) {
            return { ...prev, [agent.id]: result.content }
          })
        },
      })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading fleet...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      </div>
    )
  }

  const agents = data?.registry?.agents ?? []
  const modelRouting = data?.registry?.model_routing ?? {}

  const activeCount = agents.filter(function isActive(a) {
    return a.status === 'active'
  }).length
  const idleCount = agents.filter(function isIdle(a) {
    return a.status === 'idle' || !a.status
  }).length
  const scheduledCount = agents.filter(function isScheduled(a) {
    return a.cron_schedule !== null
  }).length
  const tierCount = Object.keys(modelRouting).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium text-primary-950 text-balance">
          Fleet Management
        </h1>
        <p className="text-sm text-primary-600 mt-1 text-pretty">
          {activeCount > 0 ? (
            <>
              <span className="text-green-600 font-medium">
                {activeCount} active
              </span>
              {' · '}
            </>
          ) : null}
          {idleCount} idle
          {scheduledCount > 0 ? ` · ${scheduledCount} scheduled` : ''}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusCard label="Registered" value={agents.length} />
        <StatusCard
          label="Active Now"
          value={activeCount}
          detail={activeCount > 0 ? 'Running sessions' : 'All idle'}
        />
        <StatusCard
          label="Scheduled"
          value={scheduledCount}
          detail={scheduledCount > 0 ? 'With cron jobs' : 'No cron configured'}
        />
        <StatusCard
          label="Model Tiers"
          value={tierCount}
          detail={tierCount > 0 ? Object.keys(modelRouting).join(', ') : '—'}
        />
      </div>

      {/* Compact Model Routing */}
      {tierCount > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-primary-500">
            Model routing:
          </span>
          {Object.entries(modelRouting).map(function renderRouting([
            tier,
            model,
          ]) {
            return (
              <span
                key={tier}
                className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 tabular-nums"
              >
                {tier}: {model}
              </span>
            )
          })}
        </div>
      ) : null}

      {/* Agent Grid or Empty State */}
      {agents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-primary-400">
            No agents registered in the fleet
          </p>
          <p className="text-xs text-primary-400 mt-2 text-pretty">
            Agents are configured in{' '}
            <code className="text-primary-500 bg-primary-100 px-1 py-0.5 rounded text-[11px]">
              fleet/registry.json
            </code>{' '}
            within the OpenClaw workspace.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Registered Agents
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map(function renderAgent(agent) {
              const isExpanded = Boolean(expandedSouls[agent.id])
              const isActive = agent.status === 'active'

              return (
                <div
                  key={agent.id}
                  className={cn(
                    'rounded-lg border bg-surface transition-shadow hover:shadow-md overflow-hidden',
                    isActive
                      ? 'border-primary-200 border-l-2 border-l-green-500'
                      : 'border-primary-200',
                  )}
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-primary-950 capitalize">
                          {agent.id}
                        </h3>
                        <div className="text-xs text-primary-500 mt-0.5">
                          {agent.model}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <div className="flex gap-1.5">
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium',
                              STATUS_COLORS[agent.status ?? 'idle'],
                            )}
                          >
                            {agent.status ?? 'idle'}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium',
                              COST_TIER_COLORS[agent.cost_tier] ??
                                COST_TIER_COLORS.standard,
                            )}
                          >
                            {agent.cost_tier}
                          </span>
                        </div>
                        <span className="text-[10px] text-primary-400 tabular-nums">
                          {agent.last_active
                            ? formatRelativeTime(agent.last_active)
                            : 'Never active'}
                        </span>
                      </div>
                    </div>

                    {/* Soul Preview */}
                    {agent.soul_preview ? (
                      <p className="text-xs text-primary-500 line-clamp-3 mb-3 text-pretty">
                        {agent.soul_preview}
                      </p>
                    ) : null}

                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.capabilities.map(function renderCap(cap) {
                        return (
                          <span
                            key={cap}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-600"
                          >
                            {cap}
                          </span>
                        )
                      })}
                    </div>

                    {/* Cron Schedule */}
                    {agent.cron_schedule ? (
                      <div className="text-xs rounded-md bg-primary-50 px-3 py-2 mb-3">
                        <span className="text-primary-600">
                          {describeCronSchedule(agent.cron_schedule)}
                        </span>
                        <code className="text-primary-400 ml-2 text-[10px]">
                          {agent.cron_schedule}
                        </code>
                      </div>
                    ) : null}

                    {/* Shared-Context Access */}
                    <div className="mb-3 text-xs">
                      <div className="text-primary-500 mb-1">
                        Shared-Context Access:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {agent.reads.map(function renderRead(dir) {
                          return (
                            <span
                              key={`r-${dir}`}
                              className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200"
                            >
                              R: {dir}
                            </span>
                          )
                        })}
                        {agent.writes.map(function renderWrite(dir) {
                          return (
                            <span
                              key={`w-${dir}`}
                              className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200"
                            >
                              W: {dir}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-primary-100">
                      <button
                        onClick={function handleSpawn() {
                          spawnMutation.mutate(agent.id)
                        }}
                        disabled={
                          spawnMutation.isPending || agent.status === 'active'
                        }
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
                          agent.status === 'active'
                            ? 'bg-primary-100 text-primary-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700',
                        )}
                      >
                        {spawnMutation.isPending
                          ? 'Spawning...'
                          : 'Spawn Session'}
                      </button>
                      <button
                        onClick={function handleViewSoul() {
                          handleToggleSoul(agent)
                        }}
                        className="text-xs px-3 py-1.5 rounded-md font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                      >
                        {isExpanded ? 'Hide Soul' : 'View Soul'}
                      </button>
                      <a
                        href={`/deck?add=${encodeURIComponent(agent.id)}`}
                        className="text-xs px-3 py-1.5 rounded-md font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                      >
                        Open in Deck
                      </a>
                    </div>
                  </div>

                  {/* Inline Soul Viewer */}
                  {isExpanded ? (
                    <div className="border-t border-primary-200 bg-primary-50 p-4 max-h-[300px] overflow-y-auto">
                      <pre className="text-xs text-primary-800 whitespace-pre-wrap font-mono">
                        {expandedSouls[agent.id]}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Spawn Error */}
      {spawnMutation.isError ? (
        <div className="text-sm text-red-600">
          Spawn failed:{' '}
          {spawnMutation.error instanceof Error
            ? spawnMutation.error.message
            : 'Unknown error'}
        </div>
      ) : null}

      {/* Spawn Success */}
      {spawnMutation.isSuccess ? (
        <div className="text-sm text-green-600">Agent spawned successfully</div>
      ) : null}

      {/* MCP Servers */}
      <McpServersPanel />
    </div>
  )
}
