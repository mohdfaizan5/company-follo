import { createFileRoute } from '@tanstack/react-router'
import { requireCompanyAccess, hasCompanyPermission } from '#/lib/server-workspace'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export const Route = createFileRoute('/api/overview')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'overview', 'read')
        if ('error' in scope) return scope.error
        const sql = scope.sql
        const [canReadPeople, canReadCalendar, canReadPayroll] = await Promise.all([
          hasCompanyPermission(scope, 'people', 'read'), hasCompanyPermission(scope, 'calendar', 'read'), hasCompanyPermission(scope, 'payroll', 'read'),
        ])

        const [people, pendingLeave, payments, recentPeople] = await Promise.all([
          canReadPeople ? sql`SELECT COUNT(*)::int AS count FROM employments WHERE company_id = ${scope.company.company_id} AND status <> 'ended'` : Promise.resolve([]),
          canReadCalendar ? sql`SELECT COUNT(*)::int AS count FROM leave_requests lr JOIN employments e ON e.id = lr.employment_id WHERE e.company_id = ${scope.company.company_id} AND lr.status = 'pending'` : Promise.resolve([]),
          canReadPayroll ? sql`SELECT COUNT(*)::int AS count FROM payments pay JOIN employments e ON e.id = pay.employment_id WHERE e.company_id = ${scope.company.company_id} AND pay.created_at >= date_trunc('month', now())` : Promise.resolve([]),
          canReadPeople ? sql`SELECT p.id, p.first_name, p.last_name, e.title FROM employments e JOIN people p ON p.id = e.person_id WHERE e.company_id = ${scope.company.company_id} AND e.status <> 'ended' ORDER BY e.created_at DESC LIMIT 5` : Promise.resolve([]),
        ])
        return json({
          peopleCount: people.at(0)?.count ?? 0,
          pendingLeaveCount: pendingLeave.at(0)?.count ?? 0,
          paymentsThisMonthCount: payments.at(0)?.count ?? 0,
          recentPeople,
        })
      },
    },
  },
})
