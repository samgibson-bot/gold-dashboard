import { useEffect, useRef, useState } from 'react'
import { getHeuristicFollowUpTexts } from '../lib/follow-up-generator'

type UseFollowUpSuggestionsOptions = {
  responseText: string
  contextSummary?: string
  minResponseLength?: number
  timeoutMs?: number
}

type UseFollowUpSuggestionsResult = {
  suggestions: Array<string>
  isLoading: boolean
  source: 'heuristic' | 'llm' | null
}

export function useFollowUpSuggestions({
  responseText,
  contextSummary,
  minResponseLength = 50,
  timeoutMs = 8000,
}: UseFollowUpSuggestionsOptions): UseFollowUpSuggestionsResult {
  const [suggestions, setSuggestions] = useState<Array<string>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [source, setSource] = useState<'heuristic' | 'llm' | null>(null)
  const lastResponseRef = useRef('')

  useEffect(() => {
    if (!responseText || responseText.length < minResponseLength) {
      setSuggestions([])
      setSource(null)
      return
    }

    // Deduplicate: skip if same response
    const key = responseText.slice(0, 200) + responseText.length
    if (key === lastResponseRef.current) return
    lastResponseRef.current = key

    // Immediately show heuristic suggestions
    const heuristic = getHeuristicFollowUpTexts(responseText)
    setSuggestions(heuristic)
    setSource('heuristic')

    // Try to get LLM suggestions
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    setIsLoading(true)

    fetch('/api/follow-ups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ responseText, contextSummary }),
      signal: controller.signal,
    })
      .then(
        (res) =>
          res.json() as Promise<{ ok: boolean; suggestions: Array<string> }>,
      )
      .then((data) => {
        if (data.ok && data.suggestions.length > 0) {
          setSuggestions(data.suggestions)
          setSource('llm')
        }
      })
      .catch(() => {
        // Keep heuristic suggestions on error
      })
      .finally(() => {
        clearTimeout(timeout)
        setIsLoading(false)
      })

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [responseText, contextSummary, minResponseLength, timeoutMs])

  return { suggestions, isLoading, source }
}
