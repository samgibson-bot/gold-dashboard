import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import { useState } from 'react'
import { FileBreadcrumb } from './file-breadcrumb'
import { FileList } from './file-list'
import { FileViewer } from './file-viewer'
import { CreateFileDialog } from './create-file-dialog'
import { CreateFolderDialog } from './create-folder-dialog'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { RenameDialog } from './rename-dialog'
import type {
  FileEntry,
  FileListResponse,
  FileReadResponse,
  FileWriteResponse,
} from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { Button } from '@/components/ui/button'

export function FilesPage() {
  const queryClient = useQueryClient()
  const [currentPath, setCurrentPath] = useState('.openclaw')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>(
    'idle',
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null)
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)

  useBlocker({
    blockerFn: () => {
      return !window.confirm('You have unsaved changes. Leave anyway?')
    },
    condition: isEditing,
  })

  const dirQuery = useQuery({
    queryKey: adminQueryKeys.files(currentPath),
    queryFn: async function fetchDir() {
      const res = await fetch(
        `/api/admin/files?action=list&path=${encodeURIComponent(currentPath)}`,
      )
      if (!res.ok) throw new Error('Failed to fetch directory')
      return (await res.json()) as FileListResponse
    },
  })

  function invalidateDir() {
    queryClient.invalidateQueries({
      queryKey: adminQueryKeys.files(currentPath),
    })
  }

  const writeMutation = useMutation({
    mutationFn: async function writeFile({
      path,
      content,
    }: {
      path: string
      content: string
    }) {
      const res = await fetch('/api/admin/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'write', path, content }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as FileWriteResponse
        throw new Error(data.error ?? 'Failed to save file')
      }
      return (await res.json()) as FileWriteResponse
    },
    onSuccess: function onSaveSuccess(_, variables) {
      setIsEditing(false)
      setFileContent(variables.content)
      setSaveStatus('saved')
      setSaveError(null)
      invalidateDir()
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onError: function onSaveError(err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async function deleteFile(path: string) {
      const res = await fetch('/api/admin/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', path }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as FileWriteResponse
        throw new Error(data.error ?? 'Failed to delete')
      }
      return (await res.json()) as FileWriteResponse
    },
    onSuccess: function onDeleteSuccess() {
      if (deleteTarget && selectedFile === deleteTarget.path) {
        setSelectedFile(null)
        setFileContent(null)
      }
      setDeleteTarget(null)
      invalidateDir()
    },
  })

  const renameMutation = useMutation({
    mutationFn: async function renameFile({
      oldPath,
      newPath,
    }: {
      oldPath: string
      newPath: string
    }) {
      const res = await fetch('/api/admin/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', oldPath, newPath }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as FileWriteResponse
        throw new Error(data.error ?? 'Failed to rename')
      }
      return (await res.json()) as FileWriteResponse
    },
    onSuccess: function onRenameSuccess(_, variables) {
      if (selectedFile === variables.oldPath) {
        setSelectedFile(variables.newPath)
      }
      setRenameTarget(null)
      invalidateDir()
    },
  })

  const mkdirMutation = useMutation({
    mutationFn: async function mkdir(path: string) {
      const res = await fetch('/api/admin/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mkdir', path }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as FileWriteResponse
        throw new Error(data.error ?? 'Failed to create folder')
      }
      return (await res.json()) as FileWriteResponse
    },
    onSuccess: function onMkdirSuccess() {
      setShowCreateFolder(false)
      invalidateDir()
    },
  })

  async function loadFile(path: string) {
    setFileLoading(true)
    try {
      const res = await fetch(
        `/api/admin/files?action=read&path=${encodeURIComponent(path)}`,
      )
      const data = (await res.json()) as FileReadResponse
      if (data.ok) {
        setFileContent(data.content ?? null)
      } else {
        setFileContent(null)
      }
    } catch {
      setFileContent(null)
    } finally {
      setFileLoading(false)
    }
  }

  function handleNavigate(entry: FileEntry) {
    if (entry.type === 'directory') {
      setCurrentPath(entry.path)
      setSelectedFile(null)
      setFileContent(null)
      setIsEditing(false)
    } else {
      setSelectedFile(entry.path)
      setIsEditing(false)
      loadFile(entry.path)
    }
  }

  function handleBreadcrumbNavigate(path: string) {
    setCurrentPath(path)
    setSelectedFile(null)
    setFileContent(null)
    setIsEditing(false)
  }

  function handleSave(content: string) {
    if (!selectedFile) return
    setIsEditing(true)
    writeMutation.mutate({ path: selectedFile, content })
  }

  function handleCreate(path: string, content: string) {
    writeMutation.mutate(
      { path, content },
      {
        onSuccess: function onCreateSuccess() {
          setShowCreateDialog(false)
          setSelectedFile(path)
          setFileContent(content)
        },
      },
    )
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.path)
  }

  function handleRename(oldPath: string, newPath: string) {
    renameMutation.mutate({ oldPath, newPath })
  }

  function handleMkdir(path: string) {
    mkdirMutation.mutate(path)
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary-900">Files</h1>
          <p className="text-sm text-primary-500 mt-1">
            Browse and manage files in .openclaw/
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={function handleNewFolder() {
              setShowCreateFolder(true)
            }}
          >
            New Folder
          </Button>
          <Button
            size="sm"
            onClick={function handleNewFile() {
              setShowCreateDialog(true)
            }}
          >
            New File
          </Button>
        </div>
      </div>

      {/* Save status */}
      {saveStatus === 'saved' && (
        <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
          File saved successfully
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          {saveError ?? 'Failed to save file'}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-4">
        <FileBreadcrumb
          path={currentPath}
          onNavigate={handleBreadcrumbNavigate}
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-[280px_1fr] gap-4 min-h-[600px]">
        {/* Sidebar — Directory listing */}
        <div className="rounded-lg border border-primary-200 bg-surface overflow-hidden overflow-y-auto">
          <FileList
            entries={dirQuery.data?.entries}
            isLoading={dirQuery.isLoading}
            error={dirQuery.error}
            selectedFile={selectedFile}
            onNavigate={handleNavigate}
            onRename={setRenameTarget}
            onDelete={setDeleteTarget}
          />
        </div>

        {/* Main — File viewer/editor */}
        <div className="rounded-lg border border-primary-200 bg-surface overflow-hidden">
          <FileViewer
            path={selectedFile}
            content={fileContent}
            isLoading={fileLoading}
            onSave={handleSave}
            isSaving={writeMutation.isPending}
            saveError={saveError}
          />
        </div>
      </div>

      {/* Dialogs */}
      <CreateFileDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        currentPath={currentPath}
        onCreate={handleCreate}
        isPending={writeMutation.isPending}
      />
      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        currentPath={currentPath}
        onCreate={handleMkdir}
        isPending={mkdirMutation.isPending}
      />
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={function handleDeleteClose(open) {
          if (!open) setDeleteTarget(null)
        }}
        target={deleteTarget}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
      <RenameDialog
        open={renameTarget !== null}
        onOpenChange={function handleRenameClose(open) {
          if (!open) setRenameTarget(null)
        }}
        target={renameTarget}
        onRename={handleRename}
        isPending={renameMutation.isPending}
      />
    </div>
  )
}
