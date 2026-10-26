import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { CompanyFolloShell } from '../components/dashboard-shell'
import { TooltipProvider } from '../components/ui/tooltip'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'CompanyFollo',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/logo.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: AppRoot,
  shellComponent: RootDocument,
})

function AppRoot() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import('react-grab')
    }
  }, [])

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return pathname.startsWith('/dashboard') ? (
    <CompanyFolloShell>
      <Outlet />
    </CompanyFolloShell>
  ) : (
    <Outlet />
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body
        className="font-sans antialiased [overflow-wrap:anywhere]"
        suppressHydrationWarning
      >
        <TooltipProvider>
          {children}
          <Scripts />
        </TooltipProvider>
      </body>
    </html>
  )
}
