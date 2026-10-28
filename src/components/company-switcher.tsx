import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from '#/components/ui/menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '#/components/ui/sidebar'

type CompanySwitcherProps = {
  companyName: string
  organizationName: string
  logoUrl?: string | null
}

/**
 * The data model currently exposes one active company per workspace. Keeping
 * this as a switcher makes the future multi-company picker a local change.
 */
export function CompanySwitcher({
  companyName,
  organizationName,
  logoUrl,
}: CompanySwitcherProps) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`Current company: ${companyName}`}
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="size-full object-contain p-1 outline outline-1 outline-white/10"
                />
              ) : (
                <Building2 className="size-4" />
              )}
            </span>
            <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">CompanyFollo</span>
              <span className="truncate text-xs text-sidebar-foreground/65">
                Unlocked by {companyName}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </MenuTrigger>
          <MenuPopup
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
            className="min-w-60"
          >
            <MenuGroup className={'w-56'}>
              <MenuGroupLabel>Companies</MenuGroupLabel>
              <MenuItem className="gap-3 py-2" closeOnClick={false}>
                <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="size-full object-contain p-0.5 outline outline-1 outline-black/10 dark:outline-white/10"
                    />
                  ) : (
                    <Building2 className="size-3.5" />
                  )}
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-medium">{companyName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {organizationName}
                  </span>
                </span>
                <Check
                  className="size-4 text-primary"
                  aria-label="Current company"
                />
              </MenuItem>
            </MenuGroup>
          </MenuPopup>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
