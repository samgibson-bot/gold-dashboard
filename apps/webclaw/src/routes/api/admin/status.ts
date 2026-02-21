import os from 'node:os'
import fs from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { gatewayRpc } from '../../../server/gateway'
import { sanitizeError } from '../../../server/errors'
import type {
  ProviderHealth,
  SystemMetrics,
} from '../../../screens/admin/types'

const execAsync = promisify(exec)

async function getDiskMetrics(): Promise<{
  total: string
  used: string
  available: string
  usagePercent: number
} | null> {
  try {
    const { stdout } = await execAsync('df -h /')
    const lines = stdout.trim().split('\n')
    if (lines.length < 2) return null

    const parts = lines[1].split(/\s+/)
    if (parts.length < 5) return null

    return {
      total: parts[1],
      used: parts[2],
      available: parts[3],
      usagePercent: parseFloat(parts[4].replace('%', '')),
    }
  } catch {
    return null
  }
}

async function getHostMemoryMetrics(): Promise<{
  total: number
  free: number
  available: number
} | null> {
  try {
    const meminfo = await fs.readFile('/host/proc/meminfo', 'utf-8')
    const lines = meminfo.split('\n')

    let total = 0
    let free = 0
    let available = 0

    for (const line of lines) {
      const match = line.match(/^(\w+):\s+(\d+)\s+kB/)
      if (!match) continue

      const [, key, value] = match
      const bytes = parseInt(value, 10) * 1024

      if (key === 'MemTotal') total = bytes
      else if (key === 'MemFree') free = bytes
      else if (key === 'MemAvailable') available = bytes
    }

    if (total === 0) return null
    return { total, free, available }
  } catch {
    return null
  }
}

async function getHostCpuInfo(): Promise<{ cores: number } | null> {
  try {
    const cpuinfo = await fs.readFile('/host/proc/cpuinfo', 'utf-8')
    const lines = cpuinfo.split('\n')
    const processors = lines.filter((line) => line.startsWith('processor'))
    return { cores: processors.length }
  } catch {
    return null
  }
}

async function getHostUptime(): Promise<number | null> {
  try {
    const uptime = await fs.readFile('/host/proc/uptime', 'utf-8')
    const seconds = parseFloat(uptime.split(' ')[0])
    return isNaN(seconds) ? null : seconds
  } catch {
    return null
  }
}

async function getHostLoadAverage(): Promise<[number, number, number] | null> {
  try {
    const loadavg = await fs.readFile('/host/proc/loadavg', 'utf-8')
    const parts = loadavg.trim().split(' ')
    if (parts.length < 3) return null

    const load1 = parseFloat(parts[0])
    const load5 = parseFloat(parts[1])
    const load15 = parseFloat(parts[2])

    if (isNaN(load1) || isNaN(load5) || isNaN(load15)) return null
    return [load1, load5, load15]
  } catch {
    return null
  }
}

async function getHostCpuUsage(cores: number): Promise<number | undefined> {
  try {
    const stat = await fs.readFile('/host/proc/stat', 'utf-8')
    const lines = stat.split('\n')
    const cpuLine = lines.find((line) => line.startsWith('cpu '))
    if (!cpuLine) return undefined

    const values = cpuLine.split(/\s+/).slice(1).map(Number)
    const [user, nice, system, idle] = values

    const total = user + nice + system + idle
    const active = user + nice + system
    const usagePercent = (active / total) * 100

    return usagePercent
  } catch {
    const loadAvg = await getHostLoadAverage()
    if (!loadAvg) return undefined
    return (loadAvg[0] / cores) * 100
  }
}

export const Route = createFileRoute('/api/admin/status')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Get host-level metrics
          const hostMemory = await getHostMemoryMetrics()
          const hostCpuInfo = await getHostCpuInfo()
          const hostUptime = await getHostUptime()
          const hostLoadAvg = await getHostLoadAverage()

          const hostname = os.hostname()
          const platform = os.platform()
          const release = os.release()
          const arch = os.arch()

          const cpuCount = hostCpuInfo?.cores ?? os.cpus().length
          const loadAverage = hostLoadAvg ?? [
            os.loadavg()[0],
            os.loadavg()[1],
            os.loadavg()[2],
          ]

          const totalMem = hostMemory?.total ?? os.totalmem()
          const freeMem = hostMemory?.free ?? os.freemem()
          const availableMem = hostMemory?.available ?? freeMem
          const usedMem = totalMem - availableMem

          const memUsagePercent = (usedMem / totalMem) * 100
          const systemUptime = hostUptime ?? os.uptime()

          const diskMetrics = await getDiskMetrics()
          const cpuUsage = await getHostCpuUsage(cpuCount)

          // Fetch gateway status and sessions
          const [gatewayStatus, sessionsList] = await Promise.all([
            gatewayRpc<Record<string, unknown>>('status').catch(() => null),
            gatewayRpc<{ sessions?: Array<unknown> }>('sessions.list', {
              limit: 100,
            }).catch(() => null),
          ])

          const sessions = Array.isArray(sessionsList?.sessions)
            ? sessionsList.sessions
            : []

          // Extract provider health from gateway status if available
          const rawProvider = gatewayStatus?.provider as
            | Record<string, unknown>
            | undefined
          const providerHealth: ProviderHealth | undefined = rawProvider?.active
            ? {
                active: String(rawProvider.active),
                fallbackChain: Array.isArray(rawProvider.fallbackChain)
                  ? (rawProvider.fallbackChain as Array<unknown>).map(String)
                  : undefined,
                lastSwitch: rawProvider.lastSwitch
                  ? (() => {
                      const sw = rawProvider.lastSwitch as Record<
                        string,
                        unknown
                      >
                      return {
                        from: String(sw.from ?? ''),
                        to: String(sw.to ?? ''),
                        at: String(sw.at ?? ''),
                        reason: sw.reason ? String(sw.reason) : undefined,
                      }
                    })()
                  : undefined,
              }
            : undefined

          const system: SystemMetrics = {
            hostname,
            os: `${platform} ${release}`,
            arch,
            openclawVersion: gatewayStatus?.version
              ? String(gatewayStatus.version)
              : undefined,
            cpu: {
              cores: cpuCount,
              loadAverage: [loadAverage[0], loadAverage[1], loadAverage[2]] as [
                number,
                number,
                number,
              ],
              usage: cpuUsage,
            },
            memory: {
              total: totalMem,
              free: freeMem,
              used: usedMem,
              usagePercent: memUsagePercent,
            },
            disk: diskMetrics ?? {
              total: '—',
              used: '—',
              available: '—',
              usagePercent: 0,
            },
            uptime: {
              system: systemUptime,
              openclaw:
                typeof gatewayStatus?.uptime === 'number'
                  ? gatewayStatus.uptime
                  : undefined,
            },
            gateway: gatewayStatus
              ? {
                  status: String(gatewayStatus.status ?? 'unknown'),
                  model: gatewayStatus.model
                    ? String(gatewayStatus.model)
                    : undefined,
                  version: gatewayStatus.version
                    ? String(gatewayStatus.version)
                    : undefined,
                  sessions: sessions.length,
                }
              : undefined,
            provider: providerHealth,
          }

          return json({ ok: true, system, sessions })
        } catch (err) {
          return json({ ok: false, error: sanitizeError(err) }, { status: 500 })
        }
      },
    },
  },
})
