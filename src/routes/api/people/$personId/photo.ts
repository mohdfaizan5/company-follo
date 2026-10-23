import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, validUuid } from '#/lib/server-workspace'

// Removes a person's profile photo. The stored file is left in UploadThing; only the link to it is cleared.
export const Route = createFileRoute('/api/people/$personId/photo')({
  server: { handlers: {
    DELETE: async ({ request, params }) => {
      const scope = await requireCompanyAccess(request, 'people', 'write')
      if ('error' in scope) return scope.error
      if (!validUuid(params.personId)) return apiJson({ error: 'Person not found.' }, 404)
      const removed = await scope.sql`
        UPDATE people p SET avatar_url = NULL, avatar_file_key = NULL, updated_at = now()
        WHERE p.id = ${params.personId}::uuid AND p.organization_id = ${scope.company.organization_id}
          AND EXISTS (SELECT 1 FROM employments e WHERE e.person_id = p.id AND e.company_id = ${scope.company.company_id})
        RETURNING p.id`
      if (!removed.length) return apiJson({ error: 'Person not found.' }, 404)
      return apiJson({ ok: true })
    },
  } },
})
