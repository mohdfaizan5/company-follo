import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'Create a new person and active employment in the current company. Only use after the user explicitly names the person, role, and start date.',
  inputSchema: z.object({
    name: z.string().trim().min(1).max(160),
    role: z.string().trim().min(1).max(160),
    workEmail: z.email().optional(),
    personalEmail: z.email().optional(),
    startDate: z.string().date(),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `Create ${input.name} as ${input.role}, starting ${input.startDate}?`,
  },
  async execute(input, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'people',
      'write',
    )
    if (workspace.access === 'unavailable') return workspace

    const [firstName, ...lastName] = input.name.split(/\s+/)
    try {
      const [person] = await workspace.sql`
        WITH created_person AS (
          INSERT INTO people (organization_id, first_name, last_name, work_email, personal_email)
          VALUES (${workspace.organizationId}::uuid, ${firstName}, ${lastName.join(' ') || null},
                  ${input.workEmail?.toLowerCase() ?? null}, ${input.personalEmail?.toLowerCase() ?? null})
          RETURNING id, first_name, last_name, work_email
        ), created_employment AS (
          INSERT INTO employments (person_id, company_id, title, start_date)
          SELECT id, ${workspace.companyId}::uuid, ${input.role}, ${input.startDate}::date
          FROM created_person
          RETURNING person_id, title, start_date
        )
        SELECT p.id, p.first_name, p.last_name, p.work_email, e.title, e.start_date::text AS start_date
        FROM created_person p JOIN created_employment e ON e.person_id = p.id
      `

      return {
        view: 'action_result',
        action: 'person_created',
        message:
          `${person.first_name} ${person.last_name ?? ''}`.trim() +
          ' was added to People.',
        person: {
          id: String(person.id),
          name: [person.first_name, person.last_name].filter(Boolean).join(' '),
          title: String(person.title),
          workEmail: person.work_email ? String(person.work_email) : null,
          startDate: String(person.start_date),
          profileUrl: `/dashboard/people/${person.id}`,
        },
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new Error('That work email is already used in this organization.')
      }
      throw error
    }
  },
})
