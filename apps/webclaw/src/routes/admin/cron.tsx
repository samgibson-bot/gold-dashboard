import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CronJob, CronRunEntry } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { Button } from '@/components/ui/button'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  formatDuration,
  formatRelativeTime,
  formatRelativeTimeMs,
} from '@/lib/format'

type CronResponse = {
  ok: boolean
  error?: string
  cron?: {
    jobs?: Array<CronJob>
    running?: boolean
  }
}

type CronRunsResponse = {
  ok: boolean
  error?: string
  runs?: Array<CronRunEntry>
}

export const Route = createFileRoute('/admin/cron')({
  component: CronPage,
})

function CronPage() {
  const queryClient = useQueryClient()
  const [editJob, setEditJob] = useState<CronJob | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.cron,
    queryFn: async function fetchCron() {
      const res = await fetch('/api/admin/cron')
      if (!res.ok) throw new Error('Failed to fetch cron jobs')
      return (await res.json()) as CronResponse
    },
    refetchInterval: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: async function createJob(job: Partial<CronJob>) {
      const res = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job),
      })
      if (!res.ok) throw new Error('Failed to create job')
    },
    onSuccess: function onCreateSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.cron })
      setShowForm(false)
      setEditJob(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async function updateJob(job: Partial<CronJob>) {
      const res = await fetch('/api/admin/cron', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job),
      })
      if (!res.ok) throw new Error('Failed to update job')
    },
    onSuccess: function onUpdateSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.cron })
      setShowForm(false)
      setEditJob(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async function deleteJob(id: string) {
      const res = await fetch('/api/admin/cron', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete job')
    },
    onSuccess: function onDeleteSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.cron })
      setDeleteConfirm(null)
    },
  })

  const jobs = data?.cron?.jobs ?? []

  // Compute health summary
  const enabledJobs = jobs.filter(function isEnabled(j) {
    return j.enabled
  })
  const errorJobs = enabledJobs.filter(function hasError(j) {
    return j.state?.lastStatus === 'error'
  })
  const missingDeliveryJobs = enabledJobs.filter(function noDelivery(j) {
    return j.delivery?.deliver && !j.delivery.to
  })
  const hasProblems = errorJobs.length > 0 || missingDeliveryJobs.length > 0

  function handleOpenCreate() {
    setEditJob(null)
    setShowForm(true)
  }

  function handleOpenEdit(job: CronJob) {
    setEditJob(job)
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const job: Partial<CronJob> = {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      enabled: formData.get('enabled') === 'on',
      scheduleKind: String(
        formData.get('scheduleKind') ?? 'every',
      ) as CronJob['scheduleKind'],
      everyAmount: String(formData.get('everyAmount') ?? ''),
      everyUnit: String(formData.get('everyUnit') ?? ''),
      cronExpr: String(formData.get('cronExpr') ?? ''),
      payloadText: String(formData.get('payloadText') ?? ''),
      sessionTarget: String(formData.get('sessionTarget') ?? ''),
    }
    if (editJob?.id) {
      job.id = editJob.id
      updateMutation.mutate(job)
    } else {
      createMutation.mutate(job)
    }
  }

  function toggleHistory(jobId: string) {
    setExpandedJob(function toggle(prev) {
      return prev === jobId ? null : jobId
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-primary-950">Cron Jobs</h1>
        <Button size="sm" onClick={handleOpenCreate}>
          New Job
        </Button>
      </div>

      {/* Health Summary Banner */}
      {!isLoading && hasProblems ? (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            errorJobs.length > 0
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800',
          )}
        >
          {errorJobs.length > 0 ? (
            <p>
              <span className="font-medium">
                {errorJobs.length} job{errorJobs.length > 1 ? 's' : ''} failing:
              </span>{' '}
              {errorJobs
                .map(function getName(j) {
                  return j.name
                })
                .join(', ')}
            </p>
          ) : null}
          {missingDeliveryJobs.length > 0 ? (
            <p>
              <span className="font-medium">
                {missingDeliveryJobs.length} job
                {missingDeliveryJobs.length > 1 ? 's' : ''} with no delivery
                target:
              </span>{' '}
              {missingDeliveryJobs
                .map(function getName(j) {
                  return j.name
                })
                .join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            {editJob ? 'Edit Job' : 'Create Job'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-primary-600">Name</span>
                <input
                  name="name"
                  defaultValue={editJob?.name ?? ''}
                  required
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                />
              </label>
              <label className="block">
                <span className="text-xs text-primary-600">Schedule Kind</span>
                <select
                  name="scheduleKind"
                  defaultValue={editJob?.schedule?.kind ?? editJob?.scheduleKind ?? 'every'}
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                >
                  <option value="every">Every</option>
                  <option value="cron">Cron</option>
                  <option value="once">Once</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-primary-600">Description</span>
              <input
                name="description"
                defaultValue={editJob?.description ?? ''}
                className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs text-primary-600">Every Amount</span>
                <input
                  name="everyAmount"
                  defaultValue={String(editJob?.schedule?.amount ?? editJob?.everyAmount ?? '')}
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                />
              </label>
              <label className="block">
                <span className="text-xs text-primary-600">Every Unit</span>
                <input
                  name="everyUnit"
                  defaultValue={String(editJob?.schedule?.unit ?? editJob?.everyUnit ?? '')}
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                />
              </label>
              <label className="block">
                <span className="text-xs text-primary-600">Cron Expr</span>
                <input
                  name="cronExpr"
                  defaultValue={editJob?.schedule?.expr ?? editJob?.cronExpr ?? ''}
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-primary-600">Session Target</span>
              <input
                name="sessionTarget"
                defaultValue={editJob?.sessionTarget ?? ''}
                className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
              />
            </label>
            <label className="block">
              <span className="text-xs text-primary-600">Payload</span>
              <textarea
                name="payloadText"
                defaultValue={editJob?.payloadText ?? ''}
                rows={2}
                className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface font-mono"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={editJob?.enabled ?? true}
              />
              <span className="text-sm text-primary-700">Enabled</span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" type="submit">
                {editJob ? 'Save' : 'Create'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={function handleCancel() {
                  setShowForm(false)
                  setEditJob(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading cron jobs...</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-sm text-primary-500">No cron jobs configured</div>
      ) : (
        <div className="border border-primary-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-primary-50 border-b border-primary-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Schedule
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Health
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Last Run
                </th>
                <th className="hidden lg:table-cell px-3 py-2 text-left font-medium text-primary-700">
                  Duration
                </th>
                <th className="hidden lg:table-cell px-3 py-2 text-left font-medium text-primary-700">
                  Delivery
                </th>
                <th className="px-3 py-2 text-right font-medium text-primary-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {jobs.map(function renderJob(job, i) {
                const scheduleKind =
                  job.schedule?.kind ?? job.scheduleKind
                const schedule =
                  scheduleKind === 'cron'
                    ? (job.schedule?.expr ?? job.cronExpr ?? '\u2014')
                    : scheduleKind === 'every'
                      ? (
                          `${job.schedule?.amount ?? job.everyAmount ?? ''} ${job.schedule?.unit ?? job.everyUnit ?? ''}`.trim() ||
                          '\u2014'
                        )
                      : (job.schedule?.at ?? job.scheduleAt ?? '\u2014')

                const state = job.state
                const delivery = job.delivery
                const jobId = job.id ?? String(i)
                const isExpanded = expandedJob === jobId

                return (
                  <JobRow
                    key={jobId}
                    job={job}
                    jobId={jobId}
                    schedule={schedule}
                    state={state}
                    delivery={delivery}
                    isExpanded={isExpanded}
                    deleteConfirm={deleteConfirm}
                    onEdit={handleOpenEdit}
                    onDelete={function handleDelete() {
                      setDeleteConfirm(jobId)
                    }}
                    onConfirmDelete={function handleConfirmDelete() {
                      if (job.id) deleteMutation.mutate(job.id)
                    }}
                    onCancelDelete={function handleCancelDelete() {
                      setDeleteConfirm(null)
                    }}
                    onToggleHistory={function handleToggle() {
                      toggleHistory(jobId)
                    }}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function JobRow(props: {
  job: CronJob
  jobId: string
  schedule: string
  state: CronJob['state']
  delivery: CronJob['delivery']
  isExpanded: boolean
  deleteConfirm: string | null
  onEdit: (job: CronJob) => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onToggleHistory: () => void
}) {
  const {
    job,
    jobId,
    schedule,
    state,
    delivery,
    isExpanded,
    deleteConfirm,
    onEdit,
    onDelete,
    onConfirmDelete,
    onCancelDelete,
    onToggleHistory,
  } = props

  return (
    <>
      <tr>
        <td className="px-3 py-2 text-primary-900">
          <div className="font-medium">{job.name}</div>
          {job.description ? (
            <div className="text-xs text-primary-500 truncate max-w-[200px]">
              {job.description}
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2 text-primary-700 tabular-nums">{schedule}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TooltipProvider>
              <TooltipRoot>
                <TooltipTrigger
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    job.enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-primary-100 text-primary-500',
                  )}
                >
                  {job.enabled ? 'enabled' : 'disabled'}
                </TooltipTrigger>
                <TooltipContent>
                  {job.enabled
                    ? 'Job is scheduled and will run automatically'
                    : 'Job is paused and will not run until re-enabled'}
                </TooltipContent>
              </TooltipRoot>
            </TooltipProvider>
            {state?.lastStatus ? (
              <TooltipProvider>
                <TooltipRoot>
                  <TooltipTrigger
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      state.lastStatus === 'ok'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700',
                    )}
                  >
                    {state.lastStatus}
                  </TooltipTrigger>
                  <TooltipContent>
                    {state.lastStatus === 'ok'
                      ? 'Last run completed successfully'
                      : 'Last run failed — see error message below'}
                  </TooltipContent>
                </TooltipRoot>
              </TooltipProvider>
            ) : null}
            {state?.consecutiveErrors && state.consecutiveErrors > 0 ? (
              <TooltipProvider>
                <TooltipRoot>
                  <TooltipTrigger className="text-xs text-red-600">
                    {state.consecutiveErrors}x
                  </TooltipTrigger>
                  <TooltipContent>
                    {`${state.consecutiveErrors} consecutive failure${state.consecutiveErrors > 1 ? 's' : ''} without a successful run`}
                  </TooltipContent>
                </TooltipRoot>
              </TooltipProvider>
            ) : null}
          </div>
          {state?.lastError ? (
            <div className="text-xs text-red-600 mt-0.5 truncate max-w-[250px]">
              {state.lastError}
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2 text-primary-500 text-xs tabular-nums">
          {state?.lastRunAtMs
            ? formatRelativeTimeMs(state.lastRunAtMs)
            : job.lastRun
              ? formatRelativeTime(job.lastRun)
              : '\u2014'}
        </td>
        <td className="hidden lg:table-cell px-3 py-2 text-primary-500 text-xs tabular-nums">
          {state?.lastDurationMs
            ? formatDuration(state.lastDurationMs)
            : '\u2014'}
        </td>
        <td className="hidden lg:table-cell px-3 py-2">
          <DeliveryBadge
            delivery={delivery}
            enabled={job.enabled}
            jobDeliver={job.deliver}
            jobChannel={job.channel}
            jobTo={job.to}
          />
        </td>
        <td className="px-3 py-2 text-right space-x-2">
          <button
            onClick={onToggleHistory}
            className={cn(
              'text-xs hover:text-primary-900',
              isExpanded ? 'text-primary-900 font-medium' : 'text-primary-600',
            )}
          >
            History
          </button>
          <button
            onClick={function handleEdit() {
              onEdit(job)
            }}
            className="text-xs text-primary-600 hover:text-primary-900"
          >
            Edit
          </button>
          {deleteConfirm === jobId ? (
            <>
              <button
                onClick={onConfirmDelete}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Confirm
              </button>
              <button
                onClick={onCancelDelete}
                className="text-xs text-primary-500"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          )}
        </td>
      </tr>
      {isExpanded && job.id ? (
        <tr>
          <td colSpan={7} className="px-3 py-0">
            <RunHistory jobId={job.id} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

function DeliveryBadge(props: {
  delivery: CronJob['delivery']
  enabled: boolean
  jobDeliver?: boolean
  jobChannel?: string
  jobTo?: string
}) {
  const { delivery, enabled, jobDeliver, jobChannel, jobTo } = props

  // Use delivery object if available, fall back to flat fields
  const channel = delivery?.channel ?? jobChannel
  const to = delivery?.to ?? jobTo
  const deliver = delivery?.deliver ?? jobDeliver

  if (!channel && !deliver) {
    return <span className="text-xs text-primary-400">\u2014</span>
  }

  const hasTarget = Boolean(to)

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {channel ? (
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
          {channel}
        </span>
      ) : null}
      {enabled && deliver && !hasTarget ? (
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
          no target
        </span>
      ) : null}
      {to ? (
        <span className="text-xs text-primary-500 truncate max-w-[120px]">
          {to}
        </span>
      ) : null}
    </div>
  )
}

function RunHistory(props: { jobId: string }) {
  const { jobId } = props

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.cronRuns(jobId),
    queryFn: async function fetchRuns() {
      const res = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'runs', id: jobId }),
      })
      if (!res.ok) throw new Error('Failed to fetch run history')
      return (await res.json()) as CronRunsResponse
    },
  })

  const runs = (data?.runs ?? [])

  if (isLoading) {
    return (
      <div className="py-3 text-xs text-primary-500">Loading history...</div>
    )
  }

  if (error) {
    return (
      <div className="py-3 text-xs text-red-600">
        {error instanceof Error ? error.message : 'Failed to load'}
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="py-3 text-xs text-primary-500">
        No run history available
      </div>
    )
  }

  return (
    <div className="py-3 space-y-2">
      <div className="text-xs font-medium text-primary-600 mb-1">
        Recent Runs
      </div>
      {runs.map(function renderRun(run, i) {
        const runKey = run.ts ?? run.sessionId ?? String(i)
        return (
          <div
            key={runKey}
            className="flex items-start gap-3 text-xs border-l-2 border-primary-200 pl-3 py-1"
          >
            <span
              className={cn(
                'px-1.5 py-0.5 rounded shrink-0',
                run.status === 'ok'
                  ? 'bg-green-100 text-green-700'
                  : run.status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-primary-100 text-primary-500',
              )}
            >
              {run.status ?? 'unknown'}
            </span>
            <div className="min-w-0 flex-1">
              {run.summary ? (
                <div className="text-primary-700 line-clamp-2">
                  {run.summary}
                </div>
              ) : null}
              {run.error ? (
                <div className="text-red-600 line-clamp-1 mt-0.5">
                  {run.error}
                </div>
              ) : null}
              <div className="flex items-center gap-2 mt-0.5 text-primary-400">
                {run.runAtMs ? (
                  <span>{formatRelativeTimeMs(run.runAtMs)}</span>
                ) : run.ts ? (
                  <span>{formatRelativeTime(run.ts)}</span>
                ) : null}
                {run.durationMs ? (
                  <span>{formatDuration(run.durationMs)}</span>
                ) : null}
                {run.model ? (
                  <span className="truncate max-w-[150px]">{run.model}</span>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
