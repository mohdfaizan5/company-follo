import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireMember, validUuid } from '#/lib/server-workspace'

/** Read-only access to a published company doc for any member, without the Docs permission. */
export const Route = createFileRoute('/api/my-docs/$documentId')({
  server: { handlers: {
    GET: async ({ request, params }) => {
      const scope = await requireMember(request)
      if ('error' in scope) return scope.error
      if (!validUuid(params.documentId)) return apiJson({ error: 'Document not found.' }, 404)
      const document = (await scope.sql`
        SELECT id, title, kind, content, updated_at FROM handbook_documents
        WHERE id = ${params.documentId}::uuid AND company_id = ${scope.company.company_id} AND status = 'published'
      `).at(0)
      return document ? apiJson({ document }) : apiJson({ error: 'Document not found.' }, 404)
    },
  } },
})
