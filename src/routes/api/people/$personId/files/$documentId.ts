import { createFileRoute } from '@tanstack/react-router'
import { UTApi } from 'uploadthing/server'
import { apiJson, requireCompanyAccess, validUuid } from '#/lib/server-workspace'

export const Route = createFileRoute('/api/people/$personId/files/$documentId')({
  server: { handlers: { GET: async ({ request, params }) => {
    const scope = await requireCompanyAccess(request, 'people', 'read')
    if ('error' in scope) return scope.error
    if (!validUuid(params.personId) || !validUuid(params.documentId)) return apiJson({ error: 'File not found.' }, 404)
    const document = (await scope.sql`
      SELECT d.file_key FROM documents d JOIN employments e ON e.person_id = d.person_id
      WHERE d.id = ${params.documentId}::uuid AND d.person_id = ${params.personId}::uuid
        AND d.organization_id = ${scope.company.organization_id}::uuid AND e.company_id = ${scope.company.company_id}::uuid
    `).at(0)
    if (!document) return apiJson({ error: 'File not found.' }, 404)
    const { ufsUrl } = await new UTApi().generateSignedURL(String(document.file_key), { expiresIn: 60 })
    return Response.redirect(ufsUrl, 302)
  }, PATCH: async ({ request, params }) => {
    const scope = await requireCompanyAccess(request, 'people', 'write')
    if ('error' in scope) return scope.error
    if (!validUuid(params.personId) || !validUuid(params.documentId)) return apiJson({ error: 'File not found.' }, 404)
    const body = await request.json().catch(() => null) as { displayName?: string } | null
    const displayName = body?.displayName?.trim().slice(0, 120)
    if (!displayName) return apiJson({ error: 'Enter a document name.' }, 400)
    const updated = (await scope.sql`UPDATE documents d SET display_name = ${displayName}
      FROM employments e WHERE d.id = ${params.documentId}::uuid AND d.person_id = ${params.personId}::uuid
      AND e.person_id = d.person_id AND e.company_id = ${scope.company.company_id}
      AND d.organization_id = ${scope.company.organization_id} RETURNING d.id`).at(0)
    return updated ? apiJson({ ok: true }) : apiJson({ error: 'File not found.' }, 404)
  } } },
})
