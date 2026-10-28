import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/assistant')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/agent' })
  },
  component: () => null,
})
