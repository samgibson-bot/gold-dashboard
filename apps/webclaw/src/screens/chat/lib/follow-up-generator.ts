export type FollowUpSuggestion = {
  text: string
  type: 'clarify' | 'expand' | 'example' | 'alternative' | 'actionable'
}

function hasCode(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text)
}

function hasList(text: string): boolean {
  return /^[\s]*[-*•]\s/m.test(text) || /^[\s]*\d+\.\s/m.test(text)
}

function hasAlternatives(text: string): boolean {
  return /\balternativ/i.test(text) || /\binstead\b/i.test(text)
}

function isExplanatory(text: string): boolean {
  return (
    /\bbecause\b/i.test(text) ||
    /\bexplain/i.test(text) ||
    /\bthe reason\b/i.test(text)
  )
}

function hasCaveats(text: string): boolean {
  return (
    /\bhowever\b/i.test(text) ||
    /\bbut\b/i.test(text) ||
    /\bcaveat/i.test(text) ||
    /\blimitation/i.test(text) ||
    /\bnote that\b/i.test(text)
  )
}

function extractTopics(text: string): Array<string> {
  const topics: Array<string> = []

  // Quoted terms
  const quoted = text.match(/"([^"]+)"/g)
  if (quoted) {
    topics.push(...quoted.map((q) => q.replace(/"/g, '')).slice(0, 3))
  }

  // Backticked code terms
  const backticked = text.match(/`([^`]+)`/g)
  if (backticked) {
    topics.push(...backticked.map((b) => b.replace(/`/g, '')).slice(0, 3))
  }

  // Capitalized proper nouns (2+ letters, not at sentence start)
  const properNouns = text.match(/(?<=[.!?]\s+|\n)\s*[A-Z][a-z]{2,}/g)
  if (properNouns) {
    topics.push(...properNouns.map((n) => n.trim()).slice(0, 2))
  }

  return [...new Set(topics)].slice(0, 5)
}

export function getHeuristicFollowUps(
  responseText: string,
): Array<FollowUpSuggestion> {
  const suggestions: Array<FollowUpSuggestion> = []
  const usedTypes = new Set<string>()

  function add(text: string, type: FollowUpSuggestion['type']) {
    if (usedTypes.has(type)) return
    usedTypes.add(type)
    suggestions.push({ text, type })
  }

  if (hasCode(responseText)) {
    add('Can you explain this code step by step?', 'clarify')
  }

  if (hasList(responseText)) {
    add('Can you go into more detail on these points?', 'expand')
  }

  if (hasAlternatives(responseText)) {
    add('What are the trade-offs between these approaches?', 'alternative')
  }

  if (isExplanatory(responseText)) {
    add('Can you give me a concrete example?', 'example')
  }

  if (hasCaveats(responseText)) {
    add('How can I work around these limitations?', 'actionable')
  }

  // Extract topic-based suggestions
  const topics = extractTopics(responseText)
  if (topics.length > 0 && suggestions.length < 3) {
    const topic = topics[0]
    if (!usedTypes.has('expand')) {
      add(`Tell me more about ${topic}`, 'expand')
    }
  }

  // Fill remaining with generic diverse suggestions
  const fallbacks: Array<FollowUpSuggestion> = [
    { text: 'Can you give me an example?', type: 'example' },
    { text: 'How would I implement this?', type: 'actionable' },
    { text: 'What should I consider before doing this?', type: 'clarify' },
  ]

  for (const fallback of fallbacks) {
    if (suggestions.length >= 3) break
    if (!usedTypes.has(fallback.type)) {
      suggestions.push(fallback)
      usedTypes.add(fallback.type)
    }
  }

  return suggestions.slice(0, 3)
}

export function getHeuristicFollowUpTexts(responseText: string): Array<string> {
  return getHeuristicFollowUps(responseText).map((s) => s.text)
}
