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
import { PageSkeleton } from '#/components/page-skeletons'
import type { PageSkeletonKind } from '#/components/page-skeletons'
import { NotFoundPage } from '#/components/not-found-page'
import { WorkspaceSetup } from '#/components/workspace-setup'
import { useWorkspace } from '#/lib/workspace-client'

export function DashboardPage({
  title,
  description,
  actions,
  showHeading = true,
  skeleton = 'cards',
  wide = false,
  children,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  showHeading?: boolean
  /** Placeholder shape shown while the session and workspace load. */
  skeleton?: PageSkeletonKind
  wide?: boolean
  children: React.ReactNode
}) {
  const { data: session, isPending } = authClient.useSession()
  // Fetched alongside the session instead of after it; the cookie is what authorizes it.
  const workspace = useWorkspace(true)
  if (!isPending && !session?.user) return <NotFoundPage />
  if (isPending || workspace.isPending)
    return (
      <main className="min-h-svh">
        <div
          className={`${wide ? 'max-w-7xl' : 'max-w-5xl'} mx-auto px-5 py-8 sm:px-8`}
        >
          {showHeading && (
            <div className="mb-4">
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                {title}
              </h1>
              {/* {description ? (
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null} */}
            </div>
          )}
          <PageSkeleton kind={skeleton} />
        </div>
      </main>
    )
  if (!session?.user) return <NotFoundPage />
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
    <main className="min-h-svh ">
      <div
        className={`${wide ? 'max-w-7xl' : 'max-w-5xl'} mx-auto px-5 py-8 sm:px-8`}
      >
        {showHeading && (
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                {title}
              </h1>
              {/* {description ? (
                <p className=" max-w-2xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null} */}
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
