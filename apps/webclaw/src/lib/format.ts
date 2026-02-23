export function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(2)} GB`
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: Array<string> = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.length > 0 ? parts.join(' ') : '0m'
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60_000)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`

    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`

    const diffDays = Math.floor(diffHr / 24)
    if (diffDays < 30) return `${diffDays}d ago`

    const diffMo = Math.floor(diffDays / 30)
    if (diffMo < 12) return `${diffMo}mo ago`

    return date.toLocaleDateString()
  } catch {
    return isoString
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  const min = Math.floor(sec / 60)
  const remainSec = Math.round(sec % 60)
  return remainSec > 0 ? `${min}m ${remainSec}s` : `${min}m`
}

export function formatRelativeTimeMs(ms: number): string {
  return formatRelativeTime(new Date(ms).toISOString())
}

export function describeCronSchedule(cron: string): string {
  const patterns: Partial<Record<string, string>> = {
    '* * * * *': 'Runs every minute',
    '*/5 * * * *': 'Runs every 5 minutes',
    '*/15 * * * *': 'Runs every 15 minutes',
    '*/30 * * * *': 'Runs every 30 minutes',
    '0 * * * *': 'Runs every hour',
    '0 */2 * * *': 'Runs every 2 hours',
    '0 */4 * * *': 'Runs every 4 hours',
    '0 */6 * * *': 'Runs every 6 hours',
    '0 */12 * * *': 'Runs every 12 hours',
    '0 0 * * *': 'Runs daily at midnight',
    '0 6 * * *': 'Runs daily at 6 AM',
    '0 0 * * 0': 'Runs weekly on Sunday',
    '0 0 * * 1': 'Runs weekly on Monday',
    '0 0 1 * *': 'Runs monthly on the 1st',
  }
  return patterns[cron] ?? `Scheduled: ${cron}`
}
