'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArtificialIntelligence02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'

import type { ModelInfo, ModelsResponse } from '@/routes/api/models'
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '@/components/ui/menu'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'gold-dashboard-selected-model'

function getStoredModel(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeModel(modelId: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, modelId)
  } catch {
    // ignore
  }
}

function shortName(name: string): string {
  // Remove parenthesized suffixes and limit to 3 words for compact display
  const clean = name.replace(/\s*\(.*\)$/, '')
  const words = clean.split(' ')
  return words.length > 3 ? words.slice(0, 3).join(' ') : clean
}

type ModelSelectorProps = {
  className?: string
  onModelChange?: (modelId: string) => void
}

export function ModelSelector({
  className,
  onModelChange,
}: ModelSelectorProps) {
  const [models, setModels] = useState<Array<ModelInfo>>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    fetch('/api/models', { signal: controller.signal })
      .then((res) => res.json() as Promise<ModelsResponse>)
      .then((data) => {
        if (!data.ok && data.models.length === 0) return
        setModels(data.models)

        const stored = getStoredModel()
        const match = data.models.find((m) => m.id === stored)
        const initial = match ? match.id : data.defaultModel
        setSelectedId(initial)
      })
      .catch(() => {
        // ignore abort or network errors
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  const handleSelect = useCallback(
    (modelId: string) => {
      setSelectedId(modelId)
      storeModel(modelId)
      onModelChange?.(modelId)
    },
    [onModelChange],
  )

  // Don't render if loading or only 1 model
  if (loading || models.length <= 1) return null

  const selected = models.find((m) => m.id === selectedId) ?? models[0]

  return (
    <MenuRoot>
      <MenuTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
          'text-primary-600 hover:text-primary-900 hover:bg-primary-100',
          'transition-colors select-none',
          className,
        )}
      >
        <HugeiconsIcon
          icon={ArtificialIntelligence02Icon}
          size={14}
          strokeWidth={1.8}
        />
        <span className="hidden md:inline">{selected?.name}</span>
        <span className="md:hidden">{shortName(selected?.name ?? '')}</span>
      </MenuTrigger>
      <MenuContent side="top" align="start">
        {models.map((model) => (
          <MenuItem
            key={model.id}
            onClick={() => handleSelect(model.id)}
            className="gap-2"
          >
            <span
              className={cn(
                'w-4 shrink-0',
                model.id === selectedId ? 'opacity-100' : 'opacity-0',
              )}
            >
              <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
            </span>
            {model.name}
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  )
}
