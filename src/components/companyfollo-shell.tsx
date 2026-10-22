import { Link, useRouterState } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'
import { useWorkspace } from '#/lib/workspace-client'
import { Building2, CalendarDays, FileText, LayoutDashboard, Settings, Users } from 'lucide-react'
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
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, resource: 'overview' },
  { to: '/dashboard/people', label: 'People', icon: Users, resource: 'people' },
  { to: '/dashboard/time-off', label: 'Calendar', icon: CalendarDays, resource: 'calendar' },
  { to: '/dashboard/docs', label: 'Docs', icon: FileText, resource: 'docs' },
  { to: '/dashboard/payroll', label: 'Payroll', icon: Building2, resource: 'payroll' },
] as const

function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { data: session } = authClient.useSession()
  const { data: workspace } = useWorkspace(Boolean(session?.user))
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => { if (isMobile) setOpenMobile(false) }
  return <Sidebar collapsible="icon"><SidebarHeader><Link to="/dashboard" onClick={closeMobile} aria-label="CompanyFollo overview" className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"><span className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[10px] text-primary-foreground">C</span><span className="truncate group-data-[collapsible=icon]:hidden">CompanyFollo</span></Link></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{navigation.filter(({ resource }) => workspace?.permissions[resource].read).map(({ to, label, icon: Icon }) => <SidebarMenuItem key={to}><SidebarMenuButton render={<Link to={to} onClick={closeMobile} />} isActive={pathname === to || (to !== '/dashboard' && pathname.startsWith(to))} tooltip={label}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton render={<Link to="/dashboard/settings" onClick={closeMobile} />} isActive={pathname.startsWith('/dashboard/settings')} tooltip="Settings"><Settings /><span>Settings</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar>
}

export function CompanyFolloShell({ children }: { children: React.ReactNode }) {
  return <SidebarProvider defaultOpen><AppSidebar /><SidebarInset>{children}</SidebarInset></SidebarProvider>
}
