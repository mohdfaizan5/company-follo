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

        const companyId = scope.company.company_id
        const row = (await sql`SELECT
          CASE WHEN ${canReadPeople}::boolean THEN (SELECT COUNT(*)::int FROM employments WHERE company_id = ${companyId} AND status <> 'ended') ELSE 0 END AS people_count,
          CASE WHEN ${canReadCalendar}::boolean THEN (SELECT COUNT(*)::int FROM leave_requests lr JOIN employments e ON e.id = lr.employment_id WHERE e.company_id = ${companyId} AND lr.status = 'pending') ELSE 0 END AS pending_leave_count,
          CASE WHEN ${canReadPayroll}::boolean THEN (SELECT COUNT(*)::int FROM payments pay JOIN employments e ON e.id = pay.employment_id WHERE e.company_id = ${companyId} AND pay.created_at >= date_trunc('month', now())) ELSE 0 END AS payments_count,
          CASE WHEN ${canReadPeople}::boolean THEN (SELECT COALESCE(json_agg(r), '[]'::json) FROM (SELECT p.id, p.first_name, p.last_name, e.title FROM employments e JOIN people p ON p.id = e.person_id WHERE e.company_id = ${companyId} AND e.status <> 'ended' ORDER BY e.created_at DESC LIMIT 5) r) ELSE '[]'::json END AS recent_people`).at(0)
        return json({
          peopleCount: row?.people_count ?? 0,
          pendingLeaveCount: row?.pending_leave_count ?? 0,
          paymentsThisMonthCount: row?.payments_count ?? 0,
          recentPeople: row?.recent_people ?? [],
        })
      },
    },
  },
})
