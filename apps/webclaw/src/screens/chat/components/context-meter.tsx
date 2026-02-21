import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type ContextMeterProps = {
  totalTokens?: number
  contextTokens?: number
  className?: string
}

function formatTokenCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function ContextMeterComponent({
  totalTokens,
  contextTokens,
  className,
}: ContextMeterProps) {
  const [hovered, setHovered] = useState(false)

  const { percentage, barColor, compactLabel, fullLabel, nearFull } =
    useMemo(() => {
      if (!totalTokens || !contextTokens)
        return {
          percentage: 0,
          barColor: '',
          compactLabel: '',
          fullLabel: '',
          nearFull: false,
        }
      const pct = Math.min((totalTokens / contextTokens) * 100, 100)
      const color =
        pct >= 90
          ? 'bg-red-500'
          : pct >= 70
            ? 'bg-yellow-500'
            : 'bg-emerald-500'
      const compact = `${formatTokenCompact(totalTokens)} / ${formatTokenCompact(contextTokens)}`
      const full = `${totalTokens.toLocaleString()} / ${contextTokens.toLocaleString()} tokens (${pct.toFixed(0)}%)`
      return {
        percentage: pct,
        barColor: color,
        compactLabel: compact,
        fullLabel: full,
        nearFull: pct >= 95,
      }
    }, [totalTokens, contextTokens])

  if (!totalTokens || !contextTokens || percentage === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-primary-500 relative',
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'overflow-hidden rounded-full bg-primary-100 transition-all duration-200',
          hovered ? 'w-32 h-2' : 'w-20 h-1.5',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            barColor,
            nearFull && 'animate-pulse',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="tabular-nums whitespace-nowrap">{compactLabel}</span>
      {hovered ? (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 pointer-events-none">
          <div className="bg-primary-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
            {fullLabel}
            {nearFull ? (
              <div className="text-yellow-300 mt-0.5">
                ⚠ Context nearly full — consider /compact
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const MemoizedContextMeter = memo(ContextMeterComponent)

export { MemoizedContextMeter as ContextMeter }
