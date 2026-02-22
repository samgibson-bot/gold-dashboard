import { useState } from 'react'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type CreateFolderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPath: string
  onCreate: (path: string) => void
  isPending: boolean
}

const FOLDER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

export function CreateFolderDialog({
  open,
  onOpenChange,
  currentPath,
  onCreate,
  isPending,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState('')

  const isValid = FOLDER_NAME_PATTERN.test(folderName)
  const fullPath = `${currentPath}/${folderName}`

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onCreate(fullPath)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFolderName('')
    }
    onOpenChange(next)
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder in {currentPath}/
          </DialogDescription>

          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-900">
              Folder name
            </label>
            <input
              type="text"
              value={folderName}
              onChange={function handleChange(e) {
                setFolderName(e.target.value)
              }}
              placeholder="my-folder"
              className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
              autoFocus
            />
            {folderName && !isValid && (
              <p className="text-xs text-red-600">
                Must start with a letter or number and contain only letters,
                numbers, hyphens, or underscores
              </p>
            )}
            {isValid && <p className="text-xs text-primary-500">{fullPath}/</p>}
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
