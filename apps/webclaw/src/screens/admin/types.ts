export type NodeStatus = {
  name?: string
  model?: string
  uptime?: number
  version?: string
  status?: string
  tokens?: {
    input?: number
    output?: number
    total?: number
  }
  sessions?: number
}

export type Session = {
  key: string
  status: string
  messageCount?: number
  messages?: number
  lastActivity?: string
  model?: string
  tokenCount?: number
  tokens?: number
  historyLength?: number
}

export type CronJob = {
  id?: string
  name: string
  description?: string
  agentId?: string
  enabled: boolean
  scheduleKind: 'every' | 'cron' | 'once'
  scheduleAt?: string
  everyAmount?: string
  everyUnit?: string
  cronExpr?: string
  cronTz?: string
  sessionTarget?: string
  wakeMode?: string
  payloadKind?: string
  payloadText?: string
  deliver?: boolean
  channel?: string
  to?: string
  timeoutSeconds?: string
  lastRun?: string
  nextRun?: string
  status?: string
}

export type CronStatus = {
  jobs?: Array<CronJob>
  running?: boolean
}

export type BrowserPage = {
  id: string
  url: string
  title?: string
  viewport?: {
    width: number
    height: number
  }
}

export type BrowserStatus = {
  running?: boolean
  pages?: number
  status?: string
  pageList?: Array<BrowserPage>
}

export type GatewayConfig = {
  [key: string]: unknown
}

export type LogEntry = {
  timestamp: string
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string
  source?: string
  data?: Record<string, unknown>
}

export type UsageStats = {
  totalCost?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  costPerMillionTokens?: number
  period?: {
    start: string
    end: string
  }
  byModel?: Array<{
    model: string
    tokens: number
    cost: number
  }>
  bySession?: Array<{
    sessionKey: string
    tokens: number
    cost: number
    model?: string
  }>
  history?: Array<{
    date: string
    tokens: number
    cost: number
  }>
}

export type IdeaFile = {
  path: string
  title: string
  created?: string
  status?: string
  tags?: Array<string>
  content?: string
  metadata?: Record<string, string>
  slug?: string
  branch?: string
  githubUrl?: string
  prNumber?: number
  prUrl?: string
}

export type SystemMetrics = {
  hostname: string
  os: string
  arch: string
  openclawVersion?: string
  cpu: {
    cores: number
    loadAverage: [number, number, number]
    usage?: number
  }
  memory: {
    total: number
    free: number
    used: number
    usagePercent: number
  }
  disk: {
    total: string
    used: string
    available: string
    usagePercent: number
  }
  uptime: {
    system: number
    openclaw?: number
  }
  gateway?: {
    status: string
    model?: string
    version?: string
    sessions: number
  }
}
