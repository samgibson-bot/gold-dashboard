import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { StatusCard } from '@/components/ui/status-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BrowserStatus, BrowserPage } from '@/screens/admin/types'

type BrowserResponse = {
  ok: boolean
  error?: string
  status?: BrowserStatus
}

export const Route = createFileRoute('/admin/browser')({
  component: BrowserPage_,
})

function BrowserPage_() {
  const queryClient = useQueryClient()
  const [navigatePageId, setNavigatePageId] = useState<string | null>(null)
  const [navigateUrl, setNavigateUrl] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.browser,
    queryFn: async function fetchBrowser() {
      const res = await fetch('/api/admin/browser')
      if (!res.ok) throw new Error('Failed to fetch browser status')
      return (await res.json()) as BrowserResponse
    },
    refetchInterval: 15_000,
  })

  const actionMutation = useMutation({
    mutationFn: async function browserAction(payload: Record<string, unknown>) {
      const res = await fetch('/api/admin/browser', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Browser action failed')
    },
    onSuccess: function onActionSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.browser })
      setNavigatePageId(null)
      setNavigateUrl('')
    },
  })

  const status = data?.status ?? {}
  const pages: Array<BrowserPage> = status.pageList ?? []

  function handleNavigateSubmit(pageId: string) {
    if (!navigateUrl.trim()) return
    actionMutation.mutate({
      action: 'navigate',
      pageId,
      url: navigateUrl.trim(),
    })
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-medium text-primary-950">Browser</h1>

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading browser status...</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatusCard
              label="Status"
              value={status.running ? 'Running' : 'Stopped'}
            />
            <StatusCard
              label="Open Pages"
              value={String(status.pages ?? pages.length)}
            />
            <StatusCard
              label="State"
              value={String(status.status ?? '—')}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={function handleLaunch() {
                actionMutation.mutate({ action: 'launch' })
              }}
              disabled={actionMutation.isPending || status.running === true}
            >
              Launch
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={function handleStop() {
                actionMutation.mutate({ action: 'stop' })
              }}
              disabled={actionMutation.isPending || !status.running}
            >
              Stop
            </Button>
          </div>

          {pages.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-primary-900 mb-3">
                Open Pages
              </h2>
              <div className="space-y-2">
                {pages.map(function renderPage(page) {
                  return (
                    <div
                      key={page.id}
                      className="border border-primary-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-primary-900 truncate">
                            {page.title ?? 'Untitled'}
                          </div>
                          <div className="text-xs text-primary-500 truncate">
                            {page.url}
                          </div>
                          {page.viewport ? (
                            <div className="text-xs text-primary-400 tabular-nums">
                              {page.viewport.width}x{page.viewport.height}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={function handleOpenNavigate() {
                              setNavigatePageId(
                                navigatePageId === page.id ? null : page.id,
                              )
                              setNavigateUrl(page.url)
                            }}
                            className="text-xs text-primary-600 hover:text-primary-900"
                          >
                            Navigate
                          </button>
                          <button
                            onClick={function handleClose() {
                              actionMutation.mutate({
                                action: 'close',
                                pageId: page.id,
                              })
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      {navigatePageId === page.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={navigateUrl}
                            onChange={function handleUrlChange(e) {
                              setNavigateUrl(e.target.value)
                            }}
                            placeholder="https://..."
                            className="flex-1 text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
                            onKeyDown={function handleKeyDown(e) {
                              if (e.key === 'Enter') {
                                handleNavigateSubmit(page.id)
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={function handleNavigateClick() {
                              handleNavigateSubmit(page.id)
                            }}
                          >
                            Go
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
