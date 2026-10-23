import { ChevronDown, LogOut } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { SidebarTrigger } from '#/components/ui/sidebar'
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '#/components/ui/menu'
import { LoadingState } from '#/components/loading-state'
import { NotFoundPage } from '#/components/not-found-page'
import { WorkspaceSetup } from '#/components/workspace-setup'
import { useWorkspace } from '#/lib/workspace-client'

export function DashboardPage({
  title,
  description,
  actions,
  showHeading = true,
  children,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  showHeading?: boolean
  children: React.ReactNode
}) {
  const { data: session, isPending } = authClient.useSession()
  const workspace = useWorkspace(Boolean(session?.user))
  if (isPending)
    return <LoadingState label="Loading your workspace…" />
  if (!session?.user) return <NotFoundPage />
  if (workspace.isPending)
    return <LoadingState label="Loading your workspace…" />
  if (workspace.isError)
    return (
      <main className="grid min-h-svh place-items-center p-6 text-sm text-destructive">
        {workspace.error.message}
      </main>
    )
  if (!workspace.data) return <WorkspaceSetup />
  const initials =
    session.user.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  return (
    <main className="min-h-svh">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {showHeading && (
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
