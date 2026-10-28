import { Link, useRouterState } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'
import { useWorkspace } from '#/lib/workspace-client'
import {
  Building2,
  CalendarDays,
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

export function CompanyFolloShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
