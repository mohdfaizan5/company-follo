import { ChevronsUpDown, LogOut, Settings } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '#/components/ui/menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '#/components/ui/sidebar'
import { authClient } from '#/lib/auth-client'
import { appToast } from '#/lib/toast'

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    image?: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const initials =
    user.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  async function signOut() {
    setSigningOut(true)
    const result = await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void navigate({ to: '/login' })
        },
      },
    })
    if (result.error)
      appToast.error('Could not log out', result.error, 'Please try again.')
    setSigningOut(false)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label="Open account menu"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="size-8 rounded-full">
              {user.image ? (
                <AvatarImage src={user.image} alt={user.name} />
              ) : null}
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </MenuTrigger>
          <MenuPopup
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <MenuGroup>
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name} />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </MenuGroup>
            <MenuSeparator />
            <MenuGroup>
              <MenuItem render={<Link to="/dashboard/settings" />}>
                <Settings />
                Settings
              </MenuItem>
            </MenuGroup>
            <MenuSeparator />
            <MenuItem
              disabled={signingOut}
              onClick={() => {
                void signOut()
              }}
            >
              <LogOut />
              {signingOut ? 'Logging out…' : 'Log out'}
            </MenuItem>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
