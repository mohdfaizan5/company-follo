import { createFileRoute } from '@tanstack/react-router'
import { PersonProfilePage } from './people.$personId'

export const Route = createFileRoute('/dashboard/people/$personId/')({
  component: OverviewRoute,
})

function OverviewRoute() {
  const { personId } = Route.useParams()
  return <PersonProfilePage personId={personId} section="overview" />
}
