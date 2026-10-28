import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'Add one public or company holiday to the current company calendar after the user explicitly confirms its name and date.',
  inputSchema: z.object({
    name: z.string().trim().min(1).max(120),
    date: z.string().date(),
    kind: z.enum(['company', 'public']).default('company'),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `Add ${input.name} as a ${input.kind} holiday on ${input.date}?`,
  },
  async execute(input, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'calendar',
      'write',
    )
    if (workspace.access === 'unavailable') return workspace

    try {
      const [holiday] = await workspace.sql`
        INSERT INTO holidays (company_id, name, kind, holiday_date)
        VALUES (${workspace.companyId}::uuid, ${input.name}, ${input.kind}, ${input.date}::date)
        RETURNING id, name, kind, holiday_date::text AS date
      `
      return {
        view: 'action_result',
        action: 'holiday_created',
        message: `${holiday.name} was added to the calendar.`,
        calendarUrl: '/dashboard/time-off',
        holiday: {
          id: String(holiday.id),
          name: String(holiday.name),
          kind: String(holiday.kind),
          date: String(holiday.date),
        },
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new Error('A holiday already exists on that date.')
      }
      throw error
    }
  },
})
