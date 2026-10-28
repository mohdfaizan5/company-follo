import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'Get a concise, read-only profile for one person in the current company. Use a person ID returned by list_people.',
  inputSchema: z.object({
    personId: z.uuid().describe('The person ID returned by list_people.'),
  }),
  async execute({ personId }, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'people',
      'read',
    )
    if (workspace.access === 'unavailable') return workspace

    const person = (
      await workspace.sql`
      SELECT p.id, p.first_name, p.last_name, p.work_email, p.phone_number,
             e.title, e.department, e.level, e.start_date::text AS start_date, e.status,
             manager.first_name AS manager_first_name, manager.last_name AS manager_last_name
      FROM employments e
      JOIN people p ON p.id = e.person_id
      LEFT JOIN employments manager_employment ON manager_employment.id = e.manager_employment_id
      LEFT JOIN people manager ON manager.id = manager_employment.person_id
      WHERE e.company_id = ${workspace.companyId}::uuid AND p.id = ${personId}::uuid
      LIMIT 1
    `
    ).at(0)

    if (!person)
      return {
        view: 'person_profile',
        found: false,
        message: 'That person is not in the current company.',
      }

    return {
      view: 'person_profile',
      found: true,
      id: String(person.id),
      name: [person.first_name, person.last_name].filter(Boolean).join(' '),
      title: String(person.title),
      department: person.department ? String(person.department) : null,
      level: person.level ? String(person.level) : null,
      workEmail: person.work_email ? String(person.work_email) : null,
      phoneNumber: person.phone_number ? String(person.phone_number) : null,
      startDate: String(person.start_date),
      employmentStatus: String(person.status),
      manager: person.manager_first_name
        ? [person.manager_first_name, person.manager_last_name]
            .filter(Boolean)
            .join(' ')
        : null,
      profileUrl: `/dashboard/people/${person.id}`,
    }
  },
})
