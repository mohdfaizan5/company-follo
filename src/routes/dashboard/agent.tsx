import { createFileRoute, Navigate } from '@tanstack/react-router'
import { CompanyAssistant } from '#/components/company-assistant'
import { DashboardPage } from '#/components/dashboard-page'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'

export const Route = createFileRoute('/dashboard/agent')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    await context.queryClient.ensureQueryData(workspaceQueryOptions)
  },
  component: AgentPage,
})

function AgentPage() {
  const workspace = useWorkspace(true)
  if (workspace.data && !workspace.data.permissions.agent.read)
    return <Navigate to="/dashboard" replace />

  return (
    <DashboardPage title="Agent" showHeading={false} skeleton="cards" wide>
      <CompanyAssistant />
    </DashboardPage>
  )
}
