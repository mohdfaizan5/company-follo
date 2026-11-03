import { Link, useRouterState } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'
import { useWorkspace } from '#/lib/workspace-client'
import {
  Building2,
  CalendarDays,
  Ellipsis,
  FileText,
  LayoutDashboard,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from '#/components/ui/sidebar'
import { NavUser } from '#/components/nav-user'
import { CompanySwitcher } from './company-switcher'
import { cn } from '#/lib/utils'

const navigation = [
  {
    to: '/dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    resource: 'overview',
  },
  { to: '/dashboard/people', label: 'People', icon: Users, resource: 'people' },
  {
    to: '/dashboard/time-off',
    label: 'Calendar',
    icon: CalendarDays,
    resource: 'calendar',
  },
  { to: '/dashboard/docs', label: 'Docs', icon: FileText, resource: 'docs' },
  {
    to: '/dashboard/agent',
    label: 'Agent',
    icon: Sparkles,
    resource: 'agent',
  },
  {
    to: '/dashboard/payroll',
    label: 'Finance',
    icon: Building2,
    resource: 'payroll',
  },
] as const

function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { data: session } = authClient.useSession()
  const { data: workspace } = useWorkspace(Boolean(session?.user))
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }
  return (
    <Sidebar className="max-w-60" collapsible="icon">
      <SidebarHeader>
        {workspace ? (
          <CompanySwitcher
            companyName={workspace.company_name}
            organizationName={workspace.organization_name}
            logoUrl={workspace.logo_url}
          />
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/dashboard/me" onClick={closeMobile} />}
                  isActive={
                    pathname === '/dashboard/me' ||
                    pathname.startsWith('/dashboard/handbook')
                  }
                  tooltip="My profile"
                >
                  <UserRound />
                  <span>My profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {workspace && !workspace.permissions.calendar.read && (
                // Without access to the company calendar, people still see holidays and their own leave.
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link to="/dashboard/my-calendar" onClick={closeMobile} />
                    }
                    isActive={pathname === '/dashboard/my-calendar'}
                    tooltip="Calendar"
                  >
                    <CalendarDays />
                    <span>Calendar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {navigation
                .filter(
                  ({ resource }) =>
                    workspace?.permissions[resource].read &&
                    !(resource === 'overview' && workspace.role === 'employee'),
                )
                .map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      render={<Link to={to} onClick={closeMobile} />}
                      isActive={
                        pathname === to ||
                        (to !== '/dashboard' && pathname.startsWith(to))
                      }
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: session?.user.name ?? 'User',
            email: session?.user.email ?? '',
            image: session?.user.image,
          }}
        />
        <SidebarRail />
        {/* <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/dashboard/settings" onClick={closeMobile} />}
              isActive={pathname.startsWith('/dashboard/settings')}
              tooltip="Settings"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu> */}
      </SidebarFooter>
    </Sidebar>
  )
}

/** Thumb-reachable bottom tabs for phones; the sidebar sheet holds everything else behind "More". */
function MobileTabBar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { data: session } = authClient.useSession()
  const { data: workspace } = useWorkspace(Boolean(session?.user))
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  if (!isMobile || !workspace) return null

  const tabs = [
    ...navigation
      .filter(
        ({ resource }) =>
          workspace.permissions[resource].read &&
          !(resource === 'overview' && workspace.role === 'employee'),
      )
      .map(({ to, label, icon }) => ({ to: to as string, label, icon })),
    ...(workspace.permissions.calendar.read
      ? []
      : [
          {
            to: '/dashboard/my-calendar',
            label: 'Calendar',
            icon: CalendarDays,
          },
        ]),
    { to: '/dashboard/me', label: 'Me', icon: UserRound },
  ]
  // Keep four tabs plus More so every target stays at least ~64px wide on a 320px screen.
  const visible = tabs.slice(0, 4)
  const isActive = (to: string) =>
    to === '/dashboard/me'
      ? pathname === to || pathname.startsWith('/dashboard/handbook')
      : pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
  const itemClass =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium no-underline transition-colors active:bg-accent'

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {visible.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          aria-current={isActive(to) ? 'page' : undefined}
          className={cn(
            itemClass,
            isActive(to) ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-5" />
          <span className="max-w-full truncate">{label}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        aria-label="More navigation"
        aria-expanded={openMobile}
        className={cn(itemClass, 'text-muted-foreground')}
      >
        <Ellipsis className="size-5" />
        <span>More</span>
      </button>
    </nav>
  )
}

export function CompanyFolloShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      {/* Reserve room under the content for the fixed bottom tab bar on phones. */}
      <SidebarInset className="max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        {children}
      </SidebarInset>
      <MobileTabBar />
    </SidebarProvider>
  )
}
