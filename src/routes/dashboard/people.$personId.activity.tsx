import { createFileRoute } from '@tanstack/react-router'
import { PersonProfilePage } from './people.$personId'
export const Route = createFileRoute('/dashboard/people/$personId/activity')({
  component: ActivityRoute,
})
function ActivityRoute() {
  const { personId } = Route.useParams()
  return <PersonProfilePage personId={personId} section="activity" />
}
