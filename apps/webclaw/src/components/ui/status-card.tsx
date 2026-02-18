import { cn } from '@/lib/utils'

type StatusCardProps = {
  label: string
  value: React.ReactNode
  detail?: string
  className?: string
}

export function StatusCard({
  label,
  value,
  detail,
  className,
}: StatusCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary-200 bg-surface p-4',
        className,
      )}
    >
      <div className="text-xs text-primary-500 mb-1">{label}</div>
      <div className="text-lg font-medium text-primary-950 tabular-nums">
        {value}
      </div>
      {detail ? (
        <div className="text-xs text-primary-400 mt-1 truncate">{detail}</div>
      ) : null}
    </div>
  )
}
