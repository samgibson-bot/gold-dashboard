import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AdminNav } from '@/components/admin-nav'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="h-screen bg-surface text-primary-900 grid grid-cols-[auto_1fr]">
      <AdminNav />
      <main className="flex flex-col h-full min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
