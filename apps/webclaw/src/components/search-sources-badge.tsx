import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type SearchSourcesBadgeProps = {
  urls: Array<string>
  className?: string
}

const MAX_VISIBLE_FAVICONS = 3

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

function SearchSourcesBadgeComponent({
  urls,
  className,
}: SearchSourcesBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  const domains = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<string> = []
    for (const url of urls) {
      const domain = extractDomain(url)
      if (domain && !seen.has(domain)) {
        seen.add(domain)
        result.push(domain)
      }
    }
    return result
  }, [urls])

  if (domains.length === 0) return null

  const visible = domains.slice(0, MAX_VISIBLE_FAVICONS)
  const overflow = domains.length - MAX_VISIBLE_FAVICONS

  return (
    <div className={cn('inline-flex', className)}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full transition-colors',
          'border border-cyan-200 bg-cyan-50 px-2.5 py-1',
          'text-[11px] font-medium text-cyan-700',
          'hover:bg-cyan-100 hover:border-cyan-300',
        )}
      >
        <div className="flex -space-x-1">
          {visible.map((domain) => (
            <img
              key={domain}
              src={faviconUrl(domain)}
              alt={domain}
              width={16}
              height={16}
              className="size-4 rounded-full bg-white ring-1 ring-white"
              loading="lazy"
            />
          ))}
        </div>
        {overflow > 0 && <span>+{overflow}</span>}
        <span>
          {domains.length === 1 ? '1 source' : `${domains.length} sources`}
        </span>
      </button>

      {expanded && (
        <div className="ml-2 flex flex-wrap items-center gap-1.5">
          {domains.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-100 bg-white px-2 py-0.5 text-[11px] text-cyan-600"
            >
              <img
                src={faviconUrl(domain)}
                alt=""
                width={12}
                height={12}
                className="size-3"
                loading="lazy"
              />
              {domain}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const SearchSourcesBadge = memo(SearchSourcesBadgeComponent)
