import { useCallback } from 'react'

export function useSmartTitle() {
  const generateTitle = useCallback(async (message: string): Promise<string | null> => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12_000)
      const res = await fetch('/api/smart-title', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) return null
      const data = (await res.json()) as { ok: boolean; title?: string }
      return data.ok && typeof data.title === 'string' ? data.title : null
    } catch {
      return null
    }
  }, [])

  return { generateTitle }
}
