import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, slugify } from '#/lib/server-workspace'

export const Route = createFileRoute('/api/docs')({
  server: { handlers: {
    GET: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'docs', 'read')
      if ('error' in scope) return scope.error
      const documents = await scope.sql`
        SELECT id, title, slug, kind, visibility, status, updated_at
        FROM handbook_documents WHERE company_id = ${scope.company.company_id}
        ORDER BY updated_at DESC
      `
      return apiJson({ documents, companySlug: scope.company.public_slug })
    },
    POST: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'docs', 'write')
      if ('error' in scope) return scope.error
      const body = await request.json().catch(() => null) as { title?: string; kind?: string; content?: unknown } | null
      const title = body?.title?.trim().slice(0, 160) || 'Untitled'
      const kind = ['general', 'policy', 'sop', 'guide'].includes(body?.kind ?? '') ? body!.kind! : 'general'
      const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`
      // Optional starter content (used by the templates on the Docs page); must be a TipTap doc.
      const starter = body?.content && typeof body.content === 'object' && (body.content as { type?: string }).type === 'doc' ? JSON.stringify(body.content) : null
      if (starter && starter.length > 200_000) return apiJson({ error: 'That template is too large.' }, 413)
      const [document] = await scope.sql`
        INSERT INTO handbook_documents (organization_id, company_id, title, slug, kind, created_by_user_id, content)
        VALUES (${scope.company.organization_id}, ${scope.company.company_id}, ${title}, ${slug}, ${kind}, ${scope.userId}, COALESCE(${starter}::jsonb, '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb))
        RETURNING id, title, slug, kind, visibility, status, content, updated_at
      `
      if (!scope.company.public_slug) {
        const companySlug = `${slugify(scope.company.company_name)}-${String(scope.company.company_id).slice(0, 8)}`
        await scope.sql`UPDATE companies SET public_slug = ${companySlug} WHERE id = ${scope.company.company_id} AND public_slug IS NULL`
      }
      return apiJson({ document }, 201)
    },
  } },
})
