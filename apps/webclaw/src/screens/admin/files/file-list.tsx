import { HugeiconsIcon } from '@hugeicons/react'
import {
  Csv01Icon,
  File01Icon,
  FileAttachmentIcon,
  FolderOpenIcon,
  MoreVerticalIcon,
  SourceCodeIcon,
  TextIcon,
} from '@hugeicons/core-free-icons'
import type { FileEntry } from '@/screens/admin/types'
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '@/components/ui/menu'
import { cn } from '@/lib/utils'

type FileListProps = {
  entries: Array<FileEntry> | undefined
  isLoading: boolean
  error: Error | null
  selectedFile: string | null
  onNavigate: (entry: FileEntry) => void
  onRename?: (entry: FileEntry) => void
  onDelete?: (entry: FileEntry) => void
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return FileAttachmentIcon
  if (ext === 'csv') return Csv01Icon
  if (
    ext === 'ts' ||
    ext === 'tsx' ||
    ext === 'js' ||
    ext === 'jsx' ||
    ext === 'py' ||
    ext === 'sh' ||
    ext === 'json' ||
    ext === 'yaml' ||
    ext === 'yml'
  )
    return SourceCodeIcon
  if (ext === 'md' || ext === 'txt') return TextIcon
  return File01Icon
}

function sortEntries(entries: Array<FileEntry>): Array<FileEntry> {
  return [...entries].sort(function compareEntries(a, b) {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
}

export function FileList({
  entries,
  isLoading,
  error,
  selectedFile,
  onNavigate,
  onRename,
  onDelete,
}: FileListProps) {
  if (isLoading) {
    return <div className="p-4 text-sm text-primary-500">Loading...</div>
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">Failed to load directory</div>
    )
  }

  if (!entries || entries.length === 0) {
    return <div className="p-4 text-sm text-primary-500">Empty directory</div>
  }

  const sorted = sortEntries(entries)

  return (
    <div className="divide-y divide-primary-100">
      {sorted.map(function renderEntry(entry) {
        const isDir = entry.type === 'directory'
        const isSelected = entry.path === selectedFile
        const icon = isDir ? FolderOpenIcon : getFileIcon(entry.name)

        return (
          <div
            key={entry.path}
            className={cn(
              'group flex items-center text-sm transition-colors hover:bg-primary-50',
              isSelected && 'bg-blue-50 text-blue-700',
            )}
          >
            <button
              onClick={function handleClick() {
                onNavigate(entry)
              }}
              className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
            >
              <HugeiconsIcon
                icon={icon}
                size={16}
                strokeWidth={1.5}
                className={cn(
                  'shrink-0',
                  isDir ? 'text-amber-500' : 'text-primary-400',
                  isSelected && 'text-blue-600',
                )}
              />
              <span className="truncate">
                {entry.name}
                {isDir && '/'}
              </span>
            </button>

            {(onRename || onDelete) && (
              <MenuRoot>
                <MenuTrigger className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-primary-200 transition-all">
                  <HugeiconsIcon
                    icon={MoreVerticalIcon}
                    size={14}
                    strokeWidth={1.5}
                    className="text-primary-500"
                  />
                </MenuTrigger>
                <MenuContent>
                  {onRename && !isDir && (
                    <MenuItem
                      onClick={function handleRename() {
                        onRename(entry)
                      }}
                    >
                      Rename
                    </MenuItem>
                  )}
                  {onDelete && (
                    <MenuItem
                      className="text-red-600 hover:bg-red-50 data-highlighted:bg-red-50"
                      onClick={function handleDelete() {
                        onDelete(entry)
                      }}
                    >
                      Delete
                    </MenuItem>
                  )}
                </MenuContent>
              </MenuRoot>
            )}
          </div>
        )
      })}
    </div>
  )
}
