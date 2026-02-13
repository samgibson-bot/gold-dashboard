import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { cn } from '@/lib/utils'
import type { WebhookConfig } from '@/screens/admin/types'

type WebhooksResponse = {
  ok: boolean
  error?: string
  webhooks?: Array<WebhookConfig>
}

export const Route = createFileRoute('/admin/webhooks')({
  component: WebhooksPage,
})

function WebhooksPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.webhooks,
    queryFn: async function fetchWebhooks() {
      const res = await fetch('/api/admin/webhooks')
      if (!res.ok) throw new Error('Failed to fetch webhooks')
      return (await res.json()) as WebhooksResponse
    },
  })

  const createMutation = useMutation({
    mutationFn: async function createWebhook() {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newName,
          source: newSource,
        }),
      })
      if (!res.ok) throw new Error('Failed to create webhook')
      return res.json()
    },
    onSuccess: function onSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.webhooks })
      setNewName('')
      setNewSource('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async function deleteWebhook(id: string) {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      if (!res.ok) throw new Error('Failed to delete webhook')
      return res.json()
    },
    onSuccess: function onSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.webhooks })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async function toggleWebhook(id: string) {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id }),
      })
      if (!res.ok) throw new Error('Failed to toggle webhook')
      return res.json()
    },
    onSuccess: function onSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.webhooks })
    },
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-primary-500">Loading webhooks...</div>
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

  const webhooks = data?.webhooks ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-medium text-primary-950">Webhooks</h1>
        <p className="text-sm text-primary-600 mt-1">
          Receive events from external services
        </p>
      </div>

      {/* Create Webhook */}
      <div className="rounded-lg border border-primary-200 bg-surface p-4">
        <h2 className="text-sm font-medium text-primary-900 mb-3">
          Create Webhook
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Webhook name"
            value={newName}
            onChange={function handleName(e) {
              setNewName(e.target.value)
            }}
            className="flex-1 text-sm bg-primary-50 border border-primary-200 rounded px-3 py-1.5 outline-none focus:border-blue-400"
          />
          <input
            type="text"
            placeholder="Source (e.g., github, slack)"
            value={newSource}
            onChange={function handleSource(e) {
              setNewSource(e.target.value)
            }}
            className="w-48 text-sm bg-primary-50 border border-primary-200 rounded px-3 py-1.5 outline-none focus:border-blue-400"
          />
          <button
            onClick={function handleCreate() {
              if (!newName.trim()) return
              createMutation.mutate()
            }}
            disabled={!newName.trim() || createMutation.isPending}
            className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Webhook List */}
      {webhooks.length === 0 ? (
        <div className="text-center py-12 text-sm text-primary-400">
          No webhooks configured
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(function renderWebhook(webhook) {
            return (
              <div
                key={webhook.id}
                className="rounded-lg border border-primary-200 bg-surface p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-primary-900">
                      {webhook.name}
                    </h3>
                    <div className="text-xs text-primary-500 mt-0.5">
                      Source: {webhook.source}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        webhook.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary-100 text-primary-500',
                      )}
                    >
                      {webhook.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={function handleToggle() {
                        toggleMutation.mutate(webhook.id)
                      }}
                      className="text-xs px-2 py-1 rounded bg-primary-100 text-primary-600 hover:bg-primary-200 transition-colors"
                    >
                      Toggle
                    </button>
                    <button
                      onClick={function handleDelete() {
                        deleteMutation.mutate(webhook.id)
                      }}
                      className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-primary-50 rounded border border-primary-200">
                  <div className="text-[10px] text-primary-500 mb-1">
                    Webhook URL
                  </div>
                  <code className="text-xs text-primary-700 break-all">
                    {webhook.url}
                  </code>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-primary-500">
                  <span>Events: {webhook.event_count}</span>
                  {webhook.last_received ? (
                    <span>Last: {webhook.last_received}</span>
                  ) : null}
                  <span>Created: {new Date(webhook.created).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
