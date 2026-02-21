import { useEffect, useState } from 'react'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type RenameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: { name: string; path: string } | null
  onRename: (oldPath: string, newPath: string) => void
  isPending: boolean
}

const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export function RenameDialog({
  open,
  onOpenChange,
  target,
  onRename,
  isPending,
}: RenameDialogProps) {
  const [newName, setNewName] = useState('')

  useEffect(
    function syncName() {
      if (target) {
        setNewName(target.name)
      }
    },
    [target],
  )

  const isValid = FILENAME_PATTERN.test(newName) && newName !== target?.name

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !target) return

    // Replace last segment of path with new name
    const segments = target.path.split('/')
    segments[segments.length - 1] = newName
    const newPath = segments.join('/')

    onRename(target.path, newPath)
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>
            Rename{' '}
            <span className="font-medium text-primary-900">{target?.name}</span>
          </DialogDescription>

          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-900">
              New name
            </label>
            <input
              type="text"
              value={newName}
              onChange={function handleChange(e) {
                setNewName(e.target.value)
              }}
              className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
              autoFocus
            />
            {newName && !FILENAME_PATTERN.test(newName) && (
              <p className="text-xs text-red-600">
                Must start with a letter or number and contain only letters,
                numbers, dots, hyphens, or underscores
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose>Cancel</DialogClose>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}
