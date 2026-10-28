import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

const kinds = ['general', 'policy', 'sop', 'guide'] as const

export default defineTool({
  description:
    'Create a blank private company document. Use this when the user explicitly asks to start a policy, SOP, guide, or general document; direct them to Docs to write its content.',
  inputSchema: z.object({
    title: z.string().trim().min(1).max(160),
    kind: z.enum(kinds).default('general'),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `Create a private ${input.kind} document titled “${input.title}”?`,
  },
  async execute(input, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'docs',
      'write',
    )
    if (workspace.access === 'unavailable') return workspace

    const slug = `${slugify(input.title)}-${crypto.randomUUID().slice(0, 8)}`
    const [document] = await workspace.sql`
      INSERT INTO handbook_documents (organization_id, company_id, title, slug, kind, created_by_user_id, content)
      VALUES (${workspace.organizationId}::uuid, ${workspace.companyId}::uuid, ${input.title}, ${slug}, ${input.kind},
              ${requireAgentUserId(ctx.session.auth.current?.principalId)},
              '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb)
      RETURNING id, title, kind, status, visibility
    `

    return {
      view: 'action_result',
      action: 'document_created',
      message: `${document.title} is ready to edit.`,
      document: {
        id: String(document.id),
        title: String(document.title),
        kind: String(document.kind),
        status: String(document.status),
        visibility: String(document.visibility),
        documentUrl: `/dashboard/docs/${document.id}`,
      },
    }
  },
})

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'company'
  )
}
