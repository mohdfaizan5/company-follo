import { createFileRoute } from '@tanstack/react-router'
import { PersonProfilePage } from './people.$personId'
export const Route = createFileRoute('/dashboard/people/$personId/calendar')({
  component: CalendarRoute,
})
function CalendarRoute() {
  const { personId } = Route.useParams()
  return <PersonProfilePage personId={personId} section="calendar" />
}
