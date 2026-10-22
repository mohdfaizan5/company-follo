import { createFileRoute } from '@tanstack/react-router'
import { getClient } from '#/db'
import { apiJson } from '#/lib/server-workspace'

export const Route = createFileRoute('/api/handbook/$companySlug/$documentSlug')({
  server: { handlers: { GET: async ({ params }) => {
    const sql = await getClient()
    if (!sql) return apiJson({ error: 'Database unavailable.' }, 503)
    const document = (await sql`
      SELECT d.title, d.kind, d.content, d.updated_at, c.name AS company_name
      FROM handbook_documents d JOIN companies c ON c.id = d.company_id
      WHERE c.public_slug = ${params.companySlug} AND d.slug = ${params.documentSlug}
        AND d.status = 'published' AND d.visibility = 'public'
    `).at(0)
    return document ? apiJson({ document }) : apiJson({ error: 'Page not found.' }, 404)
  } } },
})
