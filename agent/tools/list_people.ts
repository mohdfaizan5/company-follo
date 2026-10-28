import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'Find active people in the current company by name, role, or department. Returns profile links for follow-up.',
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .max(100)
      .optional()
      .describe('Optional name, role, or department to search for.'),
  }),
  async execute({ query }, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'people',
      'read',
    )
    if (workspace.access === 'unavailable') return workspace

    const search = query?.trim() || null
    const people = await workspace.sql`
      SELECT p.id, p.first_name, p.last_name, p.work_email, e.title, e.department, e.level, e.start_date::text AS start_date
      FROM employments e
      JOIN people p ON p.id = e.person_id
      WHERE e.company_id = ${workspace.companyId}::uuid
        AND e.status <> 'ended'
        AND (
          ${search}::text IS NULL
          OR concat_ws(' ', p.first_name, p.last_name, e.title, e.department) ILIKE '%' || ${search} || '%'
        )
      ORDER BY p.first_name, p.last_name
      LIMIT 12
    `

    return {
      view: 'people_list',
      companyName: workspace.companyName,
      query: search,
      totalReturned: people.length,
      people: people.map((person) => ({
        id: String(person.id),
        name: [person.first_name, person.last_name].filter(Boolean).join(' '),
        title: String(person.title),
        department: person.department ? String(person.department) : null,
        level: person.level ? String(person.level) : null,
        workEmail: person.work_email ? String(person.work_email) : null,
        startDate: String(person.start_date),
        profileUrl: `/dashboard/people/${person.id}`,
      })),
    }
  },
})
