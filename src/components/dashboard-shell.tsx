import { Link, useRouterState } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'
import { useWorkspace } from '#/lib/workspace-client'
import {
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Settings,
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
  useSidebar,
} from '#/components/ui/sidebar'

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
    to: '/dashboard/payroll',
    label: 'Payroll',
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
        <Link
          to="/dashboard"
          onClick={closeMobile}
          aria-label="CompanyFollo overview"
          className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <img src="/logo.svg" alt="" className="size-5 shrink-0" />
          <span className="flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
            <span className="shrink-0">CompanyFollo</span>
            {workspace && <>
              <span aria-hidden="true" className="px-0.5 font-normal text-muted-foreground">×</span>
              <span className="truncate" title={workspace.company_name}>{workspace.company_name}</span>
            </>}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/dashboard/me" onClick={closeMobile} />}
                  isActive={pathname === '/dashboard/me' || pathname.startsWith('/dashboard/handbook')}
                  tooltip="My space"
                >
                  <UserRound />
                  <span>My space</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {workspace && !workspace.permissions.calendar.read && (
                // Without access to the company calendar, people still see holidays and their own leave.
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/dashboard/my-calendar" onClick={closeMobile} />}
                    isActive={pathname === '/dashboard/my-calendar'}
                    tooltip="Calendar"
                  >
                    <CalendarDays />
                    <span>Calendar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {navigation
                .filter(({ resource }) => workspace?.permissions[resource].read && !(resource === 'overview' && workspace.role === 'employee'))
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
        <SidebarMenu>
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
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function CompanyFolloShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
