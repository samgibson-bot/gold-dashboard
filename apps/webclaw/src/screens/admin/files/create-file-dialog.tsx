import { useState } from 'react'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type CreateFileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPath: string
  onCreate: (path: string, content: string) => void
  isPending: boolean
}

const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export function CreateFileDialog({
  open,
  onOpenChange,
  currentPath,
  onCreate,
  isPending,
}: CreateFileDialogProps) {
  const [fileName, setFileName] = useState('')
  const [content, setContent] = useState('')

  const isValid = FILENAME_PATTERN.test(fileName)
  const fullPath = `${currentPath}/${fileName}`

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onCreate(fullPath, content)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFileName('')
      setContent('')
    }
    onOpenChange(next)
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <DialogTitle>New File</DialogTitle>
          <DialogDescription>
            Create a new file in {currentPath}/
          </DialogDescription>

          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-900">
              File name
            </label>
            <input
              type="text"
              value={fileName}
              onChange={function handleChange(e) {
                setFileName(e.target.value)
              }}
              placeholder="example.md"
              className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
              autoFocus
            />
            {fileName && !isValid && (
              <p className="text-xs text-red-600">
                Must start with a letter or number and contain only letters,
                numbers, dots, hyphens, or underscores
              </p>
            )}
            {isValid && <p className="text-xs text-primary-500">{fullPath}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-900">
              Content
            </label>
            <textarea
              value={content}
              onChange={function handleChange(e) {
                setContent(e.target.value)
              }}
              rows={6}
              className="w-full px-3 py-2 text-sm font-mono border border-primary-200 rounded-lg outline-none focus:border-primary-400 resize-none transition-colors"
              placeholder="File content..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose>Cancel</DialogClose>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}
