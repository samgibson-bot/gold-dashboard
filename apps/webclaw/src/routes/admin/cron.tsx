import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CronJob } from '@/screens/admin/types'

type CronResponse = {
  ok: boolean
  error?: string
  cron?: {
    jobs?: Array<CronJob>
    running?: boolean
  }
}

export const Route = createFileRoute('/admin/cron')({
  component: CronPage,
})

function CronPage() {
  const queryClient = useQueryClient()
  const [editJob, setEditJob] = useState<CronJob | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
      scheduleKind: String(formData.get('scheduleKind') ?? 'every') as CronJob['scheduleKind'],
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-primary-950">Cron Jobs</h1>
        <Button size="sm" onClick={handleOpenCreate}>
          New Job
        </Button>
      </div>

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
                  defaultValue={editJob?.scheduleKind ?? 'every'}
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
                  defaultValue={editJob?.everyAmount ?? ''}
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                />
              </label>
              <label className="block">
                <span className="text-xs text-primary-600">Every Unit</span>
                <input
                  name="everyUnit"
                  defaultValue={editJob?.everyUnit ?? ''}
                  className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                />
              </label>
              <label className="block">
                <span className="text-xs text-primary-600">Cron Expr</span>
                <input
                  name="cronExpr"
                  defaultValue={editJob?.cronExpr ?? ''}
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
                  Status
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Next Run
                </th>
                <th className="px-3 py-2 text-right font-medium text-primary-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {jobs.map(function renderJob(job, i) {
                const schedule =
                  job.scheduleKind === 'cron'
                    ? job.cronExpr ?? '—'
                    : job.scheduleKind === 'every'
                      ? `${job.everyAmount ?? ''} ${job.everyUnit ?? ''}`
                      : job.scheduleAt ?? '—'

                return (
                  <tr key={job.id ?? i}>
                    <td className="px-3 py-2 text-primary-900">
                      <div className="font-medium">{job.name}</div>
                      {job.description ? (
                        <div className="text-xs text-primary-500 truncate max-w-[200px]">
                          {job.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-primary-700 tabular-nums">
                      {schedule}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          job.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-primary-100 text-primary-500',
                        )}
                      >
                        {job.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-primary-500 text-xs tabular-nums">
                      {job.nextRun
                        ? new Date(job.nextRun).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={function handleEdit() {
                          handleOpenEdit(job)
                        }}
                        className="text-xs text-primary-600 hover:text-primary-900"
                      >
                        Edit
                      </button>
                      {deleteConfirm === job.id ? (
                        <>
                          <button
                            onClick={function handleConfirmDelete() {
                              if (job.id) deleteMutation.mutate(job.id)
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={function handleCancelDelete() {
                              setDeleteConfirm(null)
                            }}
                            className="text-xs text-primary-500"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={function handleDelete() {
                            setDeleteConfirm(job.id ?? null)
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
