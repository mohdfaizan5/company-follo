import { createFileRoute } from '@tanstack/react-router'
import { TimeOffPage } from './time-off'

export const Route = createFileRoute('/dashboard/time-off/leaves')({
  component: LeavesPage,
})
function LeavesPage() {
  return <TimeOffPage mode="leaves" />
}
