import { memo } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { useFollowUpSuggestions } from '../hooks/use-follow-up-suggestions'
import { cn } from '@/lib/utils'

type FollowUpSuggestionsProps = {
  responseText: string
  contextSummary?: string
  onSuggestionClick: (suggestion: string) => void
  disabled?: boolean
  className?: string
}

function FollowUpSuggestionsComponent({
  responseText,
  contextSummary,
  onSuggestionClick,
  disabled = false,
  className,
}: FollowUpSuggestionsProps) {
  const { suggestions, isLoading, source } = useFollowUpSuggestions({
    responseText,
    contextSummary,
    minResponseLength: 50,
    timeoutMs: 8000,
  })

  if (suggestions.length === 0 && !isLoading) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1.5 text-[10px] text-primary-400">
        {isLoading && (
          <HugeiconsIcon
            icon={Loading03Icon}
            size={12}
            className="animate-spin"
          />
        )}
        <span>
          {source === 'llm' ? 'AI suggestions' : 'Follow-up suggestions'}
        </span>
      </div>
      <div className={cn('flex flex-wrap gap-2', isLoading && 'opacity-75')}>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSuggestionClick(suggestion)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full',
              'border border-primary-200 bg-primary-50 px-3 py-1.5',
              'text-xs text-primary-700 transition-colors',
              'hover:bg-primary-100 hover:border-primary-300 hover:text-primary-900',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {suggestion}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={12}
              strokeWidth={2}
              className="shrink-0 text-primary-400"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export const FollowUpSuggestions = memo(FollowUpSuggestionsComponent)
