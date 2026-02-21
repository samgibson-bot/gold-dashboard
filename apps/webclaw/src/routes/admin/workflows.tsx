import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { WorkflowRun, WorkflowStep } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'

type WorkflowsResponse = {
  ok: boolean
  error?: string
  workflows?: Array<WorkflowRun>
  syntheses?: Array<{ date: string; content: string }>
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-primary-200 text-primary-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-primary-100 text-primary-400',
}

const STEP_DOT_COLORS: Record<string, string> = {
  pending: 'bg-primary-300',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-primary-300',
}

export const Route = createFileRoute('/admin/workflows')({
  component: WorkflowsPage,
})

function WorkflowsPage() {
  const queryClient = useQueryClient()
  const [newTask, setNewTask] = useState('')
  const [selectedSynthesis, setSelectedSynthesis] = useState<string | null>(
    null,
  )

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.workflows,
    queryFn: async function fetchWorkflows() {
      const res = await fetch('/api/admin/workflows')
      if (!res.ok) throw new Error('Failed to fetch workflows')
      return (await res.json()) as WorkflowsResponse
    },
    refetchInterval: 15_000,
  })

  const startChainMutation = useMutation({
    mutationFn: async function startChain(task: string) {
      const res = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_review_chain', task }),
      })
      if (!res.ok) throw new Error('Failed to start review chain')
      return res.json()
    },
    onSuccess: function onSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.workflows })
      setNewTask('')
    },
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading workflows...</div>
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

  const workflows = data?.workflows ?? []
  const syntheses = data?.syntheses ?? []
  const activeSynthesis = syntheses.find(function find(s) {
    return s.date === selectedSynthesis
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-medium text-primary-950">Workflows</h1>
        <p className="text-sm text-primary-600 mt-1">
          Cron pipelines, review chains, and daily roundtable
        </p>
      </div>

      {/* Start Review Chain */}
      <div className="rounded-lg border border-primary-200 bg-surface p-4">
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Start Review Chain
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Task slug (e.g., implement-fleet-api)"
            value={newTask}
            onChange={function handleChange(e) {
              setNewTask(e.target.value)
            }}
            className="flex-1 text-sm bg-primary-50 border border-primary-200 rounded px-3 py-1.5 outline-none focus:border-blue-400"
          />
          <button
            onClick={function handleStart() {
              if (!newTask.trim()) return
              startChainMutation.mutate(newTask.trim())
            }}
            disabled={!newTask.trim() || startChainMutation.isPending}
            className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {startChainMutation.isPending ? 'Starting...' : 'Start Chain'}
          </button>
        </div>
        <div className="mt-2 text-xs text-primary-500">
          Pipeline: Engineer → Critic → Architect
        </div>
      </div>

      {/* Workflows */}
      {workflows.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Pipelines
          </h2>
          <div className="space-y-4">
            {workflows.map(function renderWorkflow(workflow) {
              return (
                <div
                  key={workflow.id}
                  className="rounded-lg border border-primary-200 bg-surface p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-primary-900">
                        {workflow.name}
                      </h3>
                      <div className="text-xs text-primary-500 mt-0.5 capitalize">
                        {workflow.type.replace('_', ' ')}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[workflow.status],
                      )}
                    >
                      {workflow.status}
                    </span>
                  </div>

                  {/* Pipeline Steps (non-roundtable) */}
                  {workflow.type !== 'roundtable' ? (
                    <div className="flex items-center gap-2">
                      {workflow.steps.map(function renderStep(
                        step: WorkflowStep,
                        i: number,
                      ) {
                        return (
                          <div
                            key={`${step.agent}-${i}`}
                            className="flex items-center gap-2"
                          >
                            {i > 0 ? (
                              <div className="w-8 h-px bg-primary-200" />
                            ) : null}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary-200 bg-primary-50">
                              <div
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  STEP_DOT_COLORS[step.status],
                                )}
                              />
                              <span className="text-xs text-primary-700 capitalize">
                                {step.agent}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}

                  {workflow.type === 'roundtable' ? (
                    <RoundtableSteps steps={workflow.steps} />
                  ) : null}

                  {workflow.completed ? (
                    <div className="mt-2 text-xs text-primary-500">
                      Completed: {workflow.completed}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-primary-400">
          No workflow runs yet
        </div>
      )}

      {/* Daily Roundtable */}
      {syntheses.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Daily Roundtable
          </h2>
          <div className="flex gap-2 mb-3">
            {syntheses.map(function renderDate(s) {
              return (
                <button
                  key={s.date}
                  onClick={function handleSelect() {
                    setSelectedSynthesis(
                      selectedSynthesis === s.date ? null : s.date,
                    )
                  }}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded font-medium transition-colors',
                    selectedSynthesis === s.date
                      ? 'bg-primary-900 text-white'
                      : 'bg-primary-100 text-primary-600 hover:bg-primary-200',
                  )}
                >
                  {s.date}
                </button>
              )
            })}
          </div>
          {activeSynthesis ? (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 max-h-[400px] overflow-y-auto">
              <pre className="text-xs text-primary-800 whitespace-pre-wrap font-mono">
                {activeSynthesis.content}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RoundtableSteps({ steps }: { steps: Array<WorkflowStep> }) {
  // Steps order: scholar(R1), engineer(R1), muse(R1), scholar(R2), engineer(R2), muse(R2), synthesis
  const round1 = steps.slice(0, 3)
  const round2 = steps.slice(3, 6)
  const synthesis = steps[6]

  return (
    <div className="space-y-3">
      {/* Round 1 */}
      <div>
        <div className="text-[10px] font-medium text-primary-500 uppercase tracking-wider mb-1.5">
          Round 1
        </div>
        <div className="flex items-center gap-2">
          {round1.map(function renderR1(step, i) {
            return (
              <div key={step.agent} className="flex items-center gap-2">
                {i > 0 ? <div className="w-4 h-px bg-primary-200" /> : null}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary-200 bg-primary-50">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      STEP_DOT_COLORS[step.status],
                    )}
                  />
                  <span className="text-xs text-primary-700 capitalize">
                    {step.agent}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Connector */}
      <div className="flex items-center gap-2 pl-4">
        <div className="w-px h-4 bg-primary-200" />
      </div>

      {/* Round 2 */}
      <div>
        <div className="text-[10px] font-medium text-primary-500 uppercase tracking-wider mb-1.5">
          Round 2
        </div>
        <div className="flex items-center gap-2">
          {round2.map(function renderR2(step, i) {
            return (
              <div key={step.agent} className="flex items-center gap-2">
                {i > 0 ? <div className="w-4 h-px bg-primary-200" /> : null}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary-200 bg-primary-50">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      STEP_DOT_COLORS[step.status],
                    )}
                  />
                  <span className="text-xs text-primary-700 capitalize">
                    {step.agent}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Connector + Synthesis */}
      {synthesis ? (
        <>
          <div className="flex items-center gap-2 pl-4">
            <div className="w-px h-4 bg-primary-200" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-teal-200 bg-teal-50 w-fit">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                STEP_DOT_COLORS[synthesis.status],
              )}
            />
            <span className="text-xs text-teal-700 font-medium">Synthesis</span>
          </div>
        </>
      ) : null}
    </div>
  )
}
