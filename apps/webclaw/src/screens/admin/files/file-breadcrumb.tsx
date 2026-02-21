type FileBreadcrumbProps = {
  path: string
  onNavigate: (path: string) => void
}

export function FileBreadcrumb({ path, onNavigate }: FileBreadcrumbProps) {
  const segments = path.split('/')

  return (
    <div className="flex items-center gap-1 text-sm">
      {segments.map(function renderSegment(segment, index) {
        const isLast = index === segments.length - 1
        const segmentPath = segments.slice(0, index + 1).join('/')

        return (
          <span key={segmentPath} className="flex items-center gap-1">
            {index > 0 && <span className="text-primary-400">/</span>}
            {isLast ? (
              <span className="text-primary-900 font-medium">{segment}</span>
            ) : (
              <button
                onClick={function handleNavigate() {
                  onNavigate(segmentPath)
                }}
                className="text-primary-600 hover:text-primary-900 hover:underline transition-colors"
              >
                {segment}
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
