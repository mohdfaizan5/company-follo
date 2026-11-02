import { createFileRoute } from '@tanstack/react-router'
import { PersonProfilePage } from './people.$personId'
export const Route = createFileRoute('/dashboard/people/$personId/documents')({
  component: DocumentsRoute,
})
function DocumentsRoute() {
  const { personId } = Route.useParams()
  return <PersonProfilePage personId={personId} section="documents" />
}
