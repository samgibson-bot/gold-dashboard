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

// Convert a cron fixed time (hour/minute in sourceTz) to a local Date object.
// Uses a one-step correction: create a naive UTC date, see what sourceTz shows,
// then shift by the difference. Accurate for all normal TZ offsets.
function cronTimeToLocalDate(hour: number, minute: number, sourceTz: string): Date {
  const now = new Date()
  const naiveMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
  )
  const naiveDate = new Date(naiveMs)
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: sourceTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(naiveDate)
  const showsHour = parseInt(tzParts.find((p) => p.type === 'hour')?.value ?? '0')
  const showsMin = parseInt(tzParts.find((p) => p.type === 'minute')?.value ?? '0')
  // Normalize diff to ±720 minutes to handle day-boundary rollovers
  let diffMins = (hour * 60 + minute) - (showsHour * 60 + showsMin)
  diffMins = ((diffMins % 1440) + 1440) % 1440
  if (diffMins > 720) diffMins -= 1440
  return new Date(naiveMs + diffMins * 60_000)
}

function localTimeStr(hour: number, minute: number, sourceTz: string): string {
  try {
    const d = cronTimeToLocalDate(hour, minute, sourceTz)
    const t = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: minute === 0 ? undefined : '2-digit',
      hour12: true,
    })
    if (t === '12:00 AM') return 'midnight'
    if (t === '12:00 PM') return 'noon'
    return t
  } catch {
    return `${hour}:${String(minute).padStart(2, '0')}`
  }
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Parse a dow field like "1", "1-5", "1,3,5" into a readable label.
function parseDow(dow: string): string | null {
  if (dow === '1-5') return 'Weekdays'
  if (dow === '0,6' || dow === '6,0') return 'Weekends'
  if (dow === '0-6' || dow === '*') return null
  const nums = dow.split(',').map(Number)
  return nums
    .map((n) => (DOW_SHORT[n] as string | undefined) ?? String(n))
    .join('/')
}

// Parse a dom field like "1", "15", "1,15" into a readable label.
function parseDom(dom: string): string | null {
  if (dom === '*') return null
  const ord = (n: number) =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
  const nums = dom.split(',').map(Number)
  return nums.map(ord).join(' & ') + ' of month'
}

// Format a cron expression + timezone into a human-readable local-time string.
export function formatCronSchedule(expr: string, tz = 'UTC'): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr

  const [minPart, hourPart, domPart, , dowPart] = parts as [
    string,
    string,
    string,
    string,
    string,
  ]

  // --- Interval patterns (no fixed clock time) ---
  if (minPart === '*' && hourPart === '*') return 'Every minute'
  if (minPart.startsWith('*/') && hourPart === '*') {
    const n = parseInt(minPart.slice(2))
    if (!isNaN(n)) return `Every ${n} min`
  }
  if (minPart === '0' && hourPart.startsWith('*/')) {
    const n = parseInt(hourPart.slice(2))
    if (!isNaN(n)) return n === 1 ? 'Every hour' : `Every ${n}h`
  }

  // --- Fixed-time patterns ---
  if (!/^\d+$/.test(minPart) || !/^\d+$/.test(hourPart)) return expr

  const hour = parseInt(hourPart)
  const minute = parseInt(minPart)
  const timeLabel = localTimeStr(hour, minute, tz)

  const dowLabel = parseDow(dowPart)
  const domLabel = domPart !== '*' ? parseDom(domPart) : null

  if (domLabel) return `${domLabel} at ${timeLabel}`
  if (dowLabel) return `${dowLabel} at ${timeLabel}`
  return `Daily at ${timeLabel}`
}

export function formatEverySchedule(
  amount: string | number | undefined,
  unit: string | undefined,
): string {
  if (!amount || !unit) return '\u2014'
  return `Every ${amount} ${unit}`
}
