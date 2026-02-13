import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import type { ApprovalItem } from '@/screens/admin/types'

type ApprovalsResponse = {
  ok: boolean
  error?: string
  approvals?: Array<ApprovalItem>
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const Route = createFileRoute('/admin/approvals')({
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.approvals,
    queryFn: async function fetchApprovals() {
      const res = await fetch('/api/admin/approvals')
      if (!res.ok) throw new Error('Failed to fetch approvals')
      return (await res.json()) as ApprovalsResponse
    },
    refetchInterval: 30_000,
  })

  const decideMutation = useMutation({
    mutationFn: async function decide(params: {
      task: string
      decision: string
      comment: string
      agent?: string
    }) {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide', ...params }),
      })
      if (!res.ok) throw new Error('Failed to record decision')
      return res.json()
    },
    onSuccess: function onSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.approvals })
      setComment('')
      setDecidingId(null)
    },
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading approvals...</div>
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

  const approvals = data?.approvals ?? []
  const pending = approvals.filter(function isPending(a) {
    return a.status === 'pending'
  })
  const decided = approvals.filter(function isDecided(a) {
    return a.status !== 'pending'
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-medium text-primary-950">Approvals</h1>
        <p className="text-sm text-primary-600 mt-1">
          {pending.length} pending &middot; {decided.length} decided
        </p>
      </div>

      {/* New Decision Form */}
      <div className="rounded-lg border border-primary-200 bg-surface p-4">
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Record New Decision
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Task slug (e.g., implement-fleet-api)"
            value={decidingId ?? ''}
            onChange={function handleChange(e) {
              setDecidingId(e.target.value)
            }}
            className="flex-1 text-sm bg-primary-50 border border-primary-200 rounded px-3 py-1.5 outline-none focus:border-blue-400"
          />
          <input
            type="text"
            placeholder="Comment (optional)"
            value={comment}
            onChange={function handleComment(e) {
              setComment(e.target.value)
            }}
            className="flex-1 text-sm bg-primary-50 border border-primary-200 rounded px-3 py-1.5 outline-none focus:border-blue-400"
          />
          <button
            onClick={function handleApprove() {
              if (!decidingId) return
              decideMutation.mutate({
                task: decidingId,
                decision: 'approved',
                comment,
              })
            }}
            disabled={!decidingId || decideMutation.isPending}
            className="text-xs px-4 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={function handleReject() {
              if (!decidingId) return
              decideMutation.mutate({
                task: decidingId,
                decision: 'rejected',
                comment,
              })
            }}
            disabled={!decidingId || decideMutation.isPending}
            className="text-xs px-4 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>

      {/* Approval History */}
      {approvals.length === 0 ? (
        <div className="text-center py-12 text-sm text-primary-400">
          No approvals recorded yet
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map(function renderApproval(approval) {
            return (
              <div
                key={approval.id}
                className="rounded-lg border border-primary-200 bg-surface p-3 flex items-start gap-3"
              >
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5',
                    STATUS_COLORS[approval.status] ?? STATUS_COLORS.pending,
                  )}
                >
                  {approval.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary-900">
                    {approval.title}
                  </div>
                  {approval.description && approval.description !== 'No description' ? (
                    <div className="text-xs text-primary-600 mt-0.5 line-clamp-2">
                      {approval.description}
                    </div>
                  ) : null}
                  <div className="flex gap-3 mt-1 text-xs text-primary-500">
                    {approval.agent ? <span>Agent: {approval.agent}</span> : null}
                    {approval.reviewer ? (
                      <span>Reviewer: {approval.reviewer}</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-primary-400 flex-shrink-0 tabular-nums">
                  {approval.created}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
