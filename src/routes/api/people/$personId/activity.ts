import { createFileRoute } from '@tanstack/react-router'
import {
  apiJson,
  requireCompanyAccess,
  validUuid,
} from '#/lib/server-workspace'

export const Route = createFileRoute('/api/people/$personId/activity')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const scope = await requireCompanyAccess(request, 'people', 'write')
        if ('error' in scope) return scope.error
        if (!validUuid(params.personId))
          return apiJson({ error: 'Person not found.' }, 404)
        const body = (await request.json().catch(() => null)) as {
          comment?: string
        } | null
        const comment = body?.comment?.trim().slice(0, 2_000)
        if (!comment) return apiJson({ error: 'Write a comment first.' }, 400)
        const person = (
          await scope.sql`SELECT id FROM people WHERE id = ${params.personId}::uuid AND organization_id = ${scope.company.organization_id}`
        ).at(0)
        if (!person) return apiJson({ error: 'Person not found.' }, 404)
        await scope.sql`INSERT INTO person_activity (person_id, organization_id, actor_membership_id, kind, summary)
        VALUES (${person.id}, ${scope.company.organization_id}, ${scope.company.membership_id}, 'commented', ${comment})`
        return apiJson({ ok: true }, 201)
      },
    },
  },
})
