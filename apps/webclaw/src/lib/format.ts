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
