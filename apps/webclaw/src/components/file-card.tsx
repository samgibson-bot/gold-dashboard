import { memo } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Csv01Icon,
  File01Icon,
  FileAttachmentIcon,
  SourceCodeIcon,
  TextIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type FileCardProps = {
  mediaType: string
  fileName?: string
  className?: string
}

const FILE_TYPE_LABELS: Partial<Record<string, string>> = {
  'application/pdf': 'PDF',
  'text/csv': 'CSV',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'text/html': 'HTML',
  'text/css': 'CSS',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'text/xml': 'XML',
  'text/yaml': 'YAML',
  'application/x-yaml': 'YAML',
  'text/x-python': 'Python',
  'application/javascript': 'JavaScript',
  'text/javascript': 'JavaScript',
  'application/typescript': 'TypeScript',
  'text/x-log': 'Log',
}

function getFileIcon(mediaType: string) {
  if (mediaType === 'application/pdf') return FileAttachmentIcon
  if (mediaType === 'text/csv') return Csv01Icon
  if (
    mediaType.startsWith('text/x-') ||
    mediaType.includes('javascript') ||
    mediaType.includes('typescript')
  )
    return SourceCodeIcon
  if (mediaType.startsWith('text/')) return TextIcon
  return File01Icon
}

function getLabel(mediaType: string, fileName?: string): string {
  if (fileName) return fileName
  return (
    FILE_TYPE_LABELS[mediaType] ??
    mediaType.split('/').pop()?.toUpperCase() ??
    'File'
  )
}

function FileCardComponent({ mediaType, fileName, className }: FileCardProps) {
  const icon = getFileIcon(mediaType)
  const label = getLabel(mediaType, fileName)
  const typeLabel =
    FILE_TYPE_LABELS[mediaType] ??
    mediaType.split('/').pop()?.toUpperCase() ??
    'File'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg',
        'border border-primary-200 bg-primary-50 px-3 py-2',
        'text-sm text-primary-700',
        className,
      )}
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeWidth={1.5}
        className="shrink-0 text-primary-500"
      />
      <div className="min-w-0">
        <div className="truncate font-medium text-primary-800">{label}</div>
        {fileName && (
          <div className="text-xs text-primary-500">{typeLabel}</div>
        )}
      </div>
    </div>
  )
}

export const FileCard = memo(FileCardComponent)
