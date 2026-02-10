import { cn } from '@/lib/utils'

type ProgressBarProps = {
  value: number
  max: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

export function ProgressBar({
  value,
  max,
  variant = 'default',
  className,
}: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100)

  // Auto-determine variant based on percentage if default
  let finalVariant = variant
  if (variant === 'default') {
    if (percent < 70) {
      finalVariant = 'success'
    } else if (percent < 85) {
      finalVariant = 'warning'
    } else {
      finalVariant = 'danger'
    }
  }

  const barColor = {
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    default: 'bg-primary-500',
  }[finalVariant]

  return (
    <div
      className={cn(
        'w-full h-2 bg-primary-100 rounded-full overflow-hidden',
        className,
      )}
    >
      <div
        className={cn('h-full transition-all duration-300', barColor)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
