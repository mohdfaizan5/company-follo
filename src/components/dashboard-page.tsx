import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { Menu, MenuGroup, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '#/components/ui/menu'
import { WorkspaceSetup } from '#/components/workspace-setup'
import { useWorkspace } from '#/lib/workspace-client'

export function DashboardPage({ title, description, actions, showHeading = true, children }: { title: string; description?: string; actions?: React.ReactNode; showHeading?: boolean; children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const workspace = useWorkspace(Boolean(session?.user))
  if (isPending) return <main className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading your workspace…</main>
  if (!session?.user) return <main className="grid min-h-svh place-items-center p-6"><div className="text-center"><p className="text-lg font-semibold">Log in to view your workspace.</p><Button className="mt-4" render={<Link to="/login" />}>Log in</Button></div></main>
  if (workspace.isPending) return <main className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading your workspace…</main>
  if (workspace.isError) return <main className="grid min-h-svh place-items-center p-6 text-sm text-destructive">{workspace.error.message}</main>
  if (!workspace.data) return <WorkspaceSetup />
  const initials = session.user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'
  return <main className="min-h-svh"><header className="flex h-14 items-center justify-between border-b px-4 sm:px-6"><div className="flex items-center gap-2"><SidebarTrigger /><span className="text-sm text-muted-foreground">{workspace.data.company_name}</span></div><Menu><MenuTrigger render={<Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Account menu" />}><Avatar className="size-7"><AvatarFallback>{initials}</AvatarFallback></Avatar><ChevronDown className="size-3.5 text-muted-foreground" /></MenuTrigger><MenuPopup align="end" className="w-56"><div className="px-2 py-1.5"><p className="truncate text-sm font-medium">{session.user.name}</p><p className="truncate text-xs text-muted-foreground">{session.user.email}</p></div><MenuSeparator /><MenuGroup><MenuItem onClick={() => { void authClient.signOut().then(() => { window.location.replace('/login') }) }}><LogOut />Log out</MenuItem></MenuGroup></MenuPopup></Menu></header><div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{showHeading && <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h1>{description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}</div>}{children}</div></main>
}
