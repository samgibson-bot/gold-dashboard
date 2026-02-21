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
  issueNumber: number
  title: string
  status: string
  tags: Array<string>
  content: string
  created: string
  issueUrl: string
  prNumber?: number
  prUrl?: string
}

export type FleetAgent = {
  id: string
  soul: string
  model: string
  capabilities: Array<string>
  cost_tier: 'low' | 'standard' | 'high'
  cron_schedule: string | null
  reads: Array<string>
  writes: Array<string>
  status?: 'idle' | 'active' | 'spawned'
  soul_content?: string
}

export type FleetRegistry = {
  agents: Array<FleetAgent>
  model_routing: Record<string, string>
  shared_context_path: string
}

export type FleetStatus = {
  ok: boolean
  error?: string
  registry?: FleetRegistry
  active_sessions?: Array<string>
}

export type SharedContextFile = {
  name: string
  path: string
  type: 'file' | 'directory'
  modified?: string
  size?: number
  content?: string
}

export type WorkspaceInfo = {
  soul?: string
  memory?: string
  agents?: string
  shared_context_files?: Array<SharedContextFile>
}

export type ActivityEvent = {
  id: string
  type: 'gateway' | 'github' | 'cron' | 'agent' | 'feedback' | 'system'
  agent?: string
  action: string
  summary: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export type ApprovalItem = {
  id: string
  type: 'pr_merge' | 'deployment' | 'agent_action' | 'decision'
  title: string
  description: string
  agent?: string
  task?: string
  status: 'pending' | 'approved' | 'rejected'
  created: string
  decided?: string
  reviewer?: string
  comment?: string
}

export type MetricPoint = {
  date: string
  value: number
}

export type MetricsSummary = {
  throughput: Array<MetricPoint>
  cycle_time: Array<MetricPoint>
  token_costs: Array<MetricPoint>
  fleet_utilization: Array<{ agent: string; hours: number }>
}

export type WebhookConfig = {
  id: string
  name: string
  url: string
  source: string
  created: string
  last_received?: string
  event_count: number
  active: boolean
}

export type WorkflowRun = {
  id: string
  name: string
  type: 'cron_pipeline' | 'review_chain'
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps: Array<WorkflowStep>
  started?: string
  completed?: string
}

export type WorkflowStep = {
  agent: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  started?: string
  completed?: string
  duration_ms?: number
  token_cost?: number
  output_preview?: string
}

export type ProviderHealth = {
  active: string
  fallbackChain?: Array<string>
  lastSwitch?: {
    from: string
    to: string
    at: string
    reason?: string
  }
}

export type McpTool = {
  name: string
  description?: string
}

export type McpServer = {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  tools?: Array<McpTool>
}

export type SkillFrontmatter = {
  name: string
  description?: string
  version?: string
  trigger?: string
  on_demand?: boolean
  agent?: string
  schedule?: string
  'user-invocable'?: boolean
  'disable-model-invocation'?: boolean
  'command-dispatch'?: string
  'command-tool'?: string
  metadata?: Record<string, unknown>
}

export type SkillInfo = {
  name: string
  description: string
  version: string
  trigger?: string
  on_demand: boolean
  agent?: string
  schedule?: string
  source: 'workspace' | 'shared' | 'bundled'
  path: string
  frontmatter: SkillFrontmatter
  body: string
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
  provider?: ProviderHealth
}
