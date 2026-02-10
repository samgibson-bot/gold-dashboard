import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ChatSidebar } from '@/screens/chat/components/chat-sidebar'
import { useQuery } from '@tanstack/react-query'
import { chatQueryKeys, fetchSessions } from '@/screens/chat/chat-queries'
import { chatUiQueryKey, getChatUiState } from '@/screens/chat/chat-ui'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const sessionsQuery = useQuery({
    queryKey: chatQueryKeys.sessions,
    queryFn: fetchSessions,
    retry: false,
  })

  const uiQuery = useQuery({
    queryKey: chatUiQueryKey,
    queryFn: () => getChatUiState(null as any),
    initialData: () => ({ isSidebarCollapsed: false }),
    staleTime: Infinity,
  })

  const sessions = Array.isArray(sessionsQuery.data?.sessions)
    ? sessionsQuery.data.sessions
    : []

  const isSidebarCollapsed = uiQuery.data?.isSidebarCollapsed ?? false

  return (
    <div className="h-screen bg-surface text-primary-900 grid grid-cols-[auto_1fr]">
      <ChatSidebar
        sessions={sessions}
        activeFriendlyId=""
        creatingSession={false}
        onCreateSession={() => {}}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => {}}
      />
      <main className="flex flex-col h-full min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
