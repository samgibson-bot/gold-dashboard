export type DeckColumnStatus =
  | 'idle'
  | 'streaming'
  | 'thinking'
  | 'tool_use'
  | 'error'
  | 'disconnected'

export type DeckMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: number
  streaming?: boolean
  toolUse?: { name: string; status: 'running' | 'done' | 'error' }
  compaction?: {
    beforeTokens: number
    afterTokens: number
    droppedMessages: number
  }
}

export type DeckColumn = {
  id: string
  sessionKey: string
  label: string
  accent: string
  model?: string
  status: DeckColumnStatus
  messages: Array<DeckMessage>
  totalTokens: number
  contextTokens?: number
  failover?: { from: string; to: string; reason: string }
}

export type DeckMode = 'free' | 'roundtable' | 'triage'
