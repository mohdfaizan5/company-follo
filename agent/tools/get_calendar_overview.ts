import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'Summarize upcoming company holidays and leave in the current calendar. This is read-only and returns the calendar link for changes.',
  inputSchema: z.object({
    daysAhead: z
      .number()
      .int()
      .min(1)
      .max(90)
      .default(30)
      .describe('How many days ahead to inspect, from 1 to 90.'),
  }),
  async execute({ daysAhead }, ctx) {
    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'calendar',
      'read',
    )
    if (workspace.access === 'unavailable') return workspace

    const [holidays, leave, pending] = await Promise.all([
      workspace.sql`
        SELECT name, kind, holiday_date::text AS date
        FROM holidays
        WHERE company_id = ${workspace.companyId}::uuid
          AND holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${daysAhead}
        ORDER BY holiday_date
        LIMIT 20
      `,
      workspace.sql`
        SELECT p.first_name, p.last_name, lp.name AS leave_type,
               r.start_date::text AS start_date, r.end_date::text AS end_date,
               r.duration_days, r.status
        FROM leave_requests r
        JOIN employments e ON e.id = r.employment_id
        JOIN people p ON p.id = e.person_id
        JOIN leave_policies lp ON lp.id = r.leave_policy_id
        WHERE e.company_id = ${workspace.companyId}::uuid
          AND r.status IN ('approved', 'pending')
          AND r.end_date >= CURRENT_DATE
          AND r.start_date <= CURRENT_DATE + ${daysAhead}
        ORDER BY r.start_date, p.first_name
        LIMIT 30
      `,
      workspace.sql`
        SELECT COUNT(*)::int AS count
        FROM leave_requests r
        JOIN employments e ON e.id = r.employment_id
        WHERE e.company_id = ${workspace.companyId}::uuid AND r.status = 'pending'
      `,
    ])

    return {
      view: 'calendar_overview',
      companyName: workspace.companyName,
      daysAhead,
      pendingRequestCount: Number(pending.at(0)?.count ?? 0),
      calendarUrl: '/dashboard/time-off',
      holidays: holidays.map((holiday) => ({
        name: String(holiday.name),
        kind: String(holiday.kind),
        date: String(holiday.date),
      })),
      leave: leave.map((item) => ({
        person: [item.first_name, item.last_name].filter(Boolean).join(' '),
        leaveType: String(item.leave_type),
        startDate: String(item.start_date),
        endDate: String(item.end_date),
        durationDays: Number(item.duration_days),
        status: String(item.status),
      })),
    }
  },
})
