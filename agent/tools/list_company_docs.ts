import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'List current company documents, rules, SOPs, and policies without returning their full contents.',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'docs',
      'read',
    )
    if (workspace.access === 'unavailable') return workspace

    const documents = await workspace.sql`
      SELECT id, title, kind, status, visibility, updated_at
      FROM handbook_documents
      WHERE company_id = ${workspace.companyId}::uuid
      ORDER BY updated_at DESC
      LIMIT 20
    `

    return {
      view: 'documents_list',
      companyName: workspace.companyName,
      documentsUrl: '/dashboard/docs',
      documents: documents.map((document) => ({
        id: String(document.id),
        title: String(document.title),
        kind: String(document.kind),
        status: String(document.status),
        visibility: String(document.visibility),
        updatedAt: String(document.updated_at),
        documentUrl: `/dashboard/docs/${document.id}`,
      })),
    }
  },
})
