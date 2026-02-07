import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfigResponse = {
  ok: boolean
  error?: string
  config?: Record<string, unknown>
}

export const Route = createFileRoute('/admin/config')({
  component: ConfigPage,
})

function ConfigPage() {
  const queryClient = useQueryClient()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.config,
    queryFn: async function fetchConfig() {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      return (await res.json()) as ConfigResponse
    },
  })

  const saveMutation = useMutation({
    mutationFn: async function saveConfig(payload: Record<string, unknown>) {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save config')
    },
    onSuccess: function onSaveSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.config })
      setEditingKey(null)
    },
  })

  const config = data?.config ?? {}

  function handleStartEdit(key: string, value: unknown) {
    setEditingKey(key)
    setEditValue(
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    )
  }

  function handleSave(key: string) {
    let parsedValue: unknown = editValue
    try {
      parsedValue = JSON.parse(editValue)
    } catch {
      // keep as string
    }
    saveMutation.mutate({ [key]: parsedValue })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-primary-950">Config</h1>
        <div className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-md px-2 py-1">
          Changes may require a restart
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading config...</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : Object.keys(config).length === 0 ? (
        <div className="text-sm text-primary-500">No config entries</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(config).map(function renderEntry([key, value]) {
            const isEditing = editingKey === key
            const displayValue =
              typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2)

            return (
              <div
                key={key}
                className="border border-primary-200 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary-900 mb-1">
                      {key}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editValue}
                          onChange={function handleChange(e) {
                            setEditValue(e.target.value)
                          }}
                          rows={Math.min(
                            10,
                            Math.max(2, displayValue.split('\n').length),
                          )}
                          className="w-full text-sm font-mono border border-primary-200 rounded-md px-2 py-1 bg-surface"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={function handleClickSave() {
                              handleSave(key)
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={function handleClickCancel() {
                              setEditingKey(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <pre
                        className={cn(
                          'text-xs font-mono text-primary-600 whitespace-pre-wrap break-all',
                          'max-h-32 overflow-auto',
                        )}
                      >
                        {displayValue}
                      </pre>
                    )}
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={function handleClickEdit() {
                        handleStartEdit(key, value)
                      }}
                      className="text-xs text-primary-500 hover:text-primary-900 shrink-0"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
