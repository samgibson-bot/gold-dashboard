import { createFileRoute } from '@tanstack/react-router'
import { FilesPage } from '@/screens/admin/files/files-page'

export const Route = createFileRoute('/admin/files')({
  component: FilesPage,
})
