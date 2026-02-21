import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FileViewerProps = {
  path: string | null
  content: string | null
  isLoading: boolean
  onSave?: (content: string) => void
  isSaving?: boolean
  saveError?: string | null
}

export function FileViewer({
  path,
  content,
  isLoading,
  onSave,
  isSaving,
  saveError,
}: FileViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  // Reset edit state when file changes
  useEffect(
    function resetOnPathChange() {
      setIsEditing(false)
      setEditContent('')
    },
    [path],
  )

  if (!path) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-primary-500">
        Select a file to view
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-primary-500">
        Loading...
      </div>
    )
  }

  const fileName = path.split('/').pop() ?? path
  const isDirty = isEditing && editContent !== content

  function handleStartEdit() {
    setEditContent(content ?? '')
    setIsEditing(true)
  }

  function handleCancel() {
    setIsEditing(false)
    setEditContent('')
  }

  function handleSave() {
    if (onSave) {
      onSave(editContent)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-primary-50 border-b border-primary-200 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-medium text-primary-900 truncate">
            {fileName}
          </h2>
          {isDirty && (
            <span className="size-2 rounded-full bg-amber-500 shrink-0" />
          )}
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </>
          ) : (
            content !== null &&
            onSave && (
              <Button size="sm" variant="outline" onClick={handleStartEdit}>
                Edit
              </Button>
            )
          )}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-200">
          {saveError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={function handleChange(e) {
              setEditContent(e.target.value)
            }}
            className={cn(
              'w-full h-full text-xs font-mono bg-primary-50 p-4 resize-none outline-none',
              'leading-5 text-primary-800',
            )}
          />
        ) : content !== null ? (
          <div className="flex text-xs font-mono">
            {/* Line numbers */}
            <div className="select-none px-3 py-3 text-right text-primary-400 bg-primary-50 border-r border-primary-200 leading-5">
              {content.split('\n').map(function renderLineNum(_, i) {
                return <div key={i}>{i + 1}</div>
              })}
            </div>
            {/* Code */}
            <pre className="flex-1 px-4 py-3 text-primary-800 whitespace-pre-wrap leading-5 overflow-x-auto">
              {content}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-primary-500">
            Unable to load file content
          </div>
        )}
      </div>
    </div>
  )
}
