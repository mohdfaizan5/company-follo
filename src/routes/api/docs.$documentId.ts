import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, validUuid } from '#/lib/server-workspace'

export const Route = createFileRoute('/api/docs/$documentId')({
  server: { handlers: {
    GET: async ({ request, params }) => {
      const scope = await requireCompanyAccess(request, 'docs', 'read')
      if ('error' in scope) return scope.error
      if (!validUuid(params.documentId)) return apiJson({ error: 'Document not found.' }, 404)
      const document = (await scope.sql`
        SELECT id, title, slug, kind, visibility, status, content, updated_at
        FROM handbook_documents WHERE id = ${params.documentId}::uuid AND company_id = ${scope.company.company_id}
      `).at(0)
      return document ? apiJson({ document, companySlug: scope.company.public_slug }) : apiJson({ error: 'Document not found.' }, 404)
    },
    PATCH: async ({ request, params }) => {
      const scope = await requireCompanyAccess(request, 'docs', 'write')
      if ('error' in scope) return scope.error
      if (!validUuid(params.documentId)) return apiJson({ error: 'Document not found.' }, 404)
      const body = await request.json().catch(() => null) as { title?: string; kind?: string; visibility?: string; status?: string; content?: unknown } | null
      if (!body) return apiJson({ error: 'Invalid document.' }, 400)
      const title = body.title?.trim().slice(0, 160)
      if (!title) return apiJson({ error: 'A title is required.' }, 400)
      if (!['general', 'policy', 'sop', 'guide'].includes(body.kind ?? '')) return apiJson({ error: 'Invalid document type.' }, 400)
      if (!['private', 'public'].includes(body.visibility ?? '')) return apiJson({ error: 'Invalid visibility.' }, 400)
      if (!['draft', 'published'].includes(body.status ?? '')) return apiJson({ error: 'Invalid status.' }, 400)
      if (!body.content || typeof body.content !== 'object' || (body.content as { type?: string }).type !== 'doc') return apiJson({ error: 'Invalid editor content.' }, 400)
      const content = JSON.stringify(body.content)
      if (content.length > 1_000_000) return apiJson({ error: 'This document is too large.' }, 413)
      const document = (await scope.sql`
        UPDATE handbook_documents SET title = ${title}, kind = ${body.kind}, visibility = ${body.visibility},
          status = ${body.status}, content = ${content}::jsonb, updated_at = now()
        WHERE id = ${params.documentId}::uuid AND company_id = ${scope.company.company_id}
        RETURNING id, title, slug, kind, visibility, status, content, updated_at
      `).at(0)
      return document ? apiJson({ document }) : apiJson({ error: 'Document not found.' }, 404)
    },
  } },
})
