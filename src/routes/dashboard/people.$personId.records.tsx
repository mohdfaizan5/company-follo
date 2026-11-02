import { createFileRoute } from '@tanstack/react-router'
import { PersonProfilePage } from './people.$personId'
export const Route = createFileRoute('/dashboard/people/$personId/records')({
  component: RecordsRoute,
})
function RecordsRoute() {
  const { personId } = Route.useParams()
  return <PersonProfilePage personId={personId} section="records" />
}
