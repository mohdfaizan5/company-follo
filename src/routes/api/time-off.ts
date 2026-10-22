import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, validDate, validUuid } from '#/lib/server-workspace'
import { leaveBalance } from '#/lib/leave-balance'

type Action =
  | { action: 'holiday'; name: string; date: string }
  | { action: 'policy'; name: string; annualAllowance: number; accrues: boolean; carryForwardLimit: number; allowHalfDays: boolean }
  | { action: 'request'; employmentId: string; policyId: string; startDate: string; endDate: string; halfDay: boolean; reason?: string }
  | { action: 'recordLeave'; employmentId: string; policyId: string; startDate: string; endDate: string; halfDay: boolean; reason?: string }
  | { action: 'review'; requestId: string; decision: 'approved' | 'declined' }
  | { action: 'removeHoliday'; holidayId: string }
  | { action: 'cancel'; requestId: string }

function dateRange(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  if (endMs < startMs || endMs - startMs > 366 * 86400000) return null
  const dates: string[] = []
  for (let ms = startMs; ms <= endMs; ms += 86400000) dates.push(new Date(ms).toISOString().slice(0, 10))
  return dates
}

export const Route = createFileRoute('/api/time-off')({
  server: { handlers: {
    GET: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'calendar', 'read')
      if ('error' in scope) return scope.error
      const [policies, holidays, requests, people] = await Promise.all([
        scope.sql`SELECT id, name, annual_allowance, accrues, accrual_per_month, carry_forward_limit, allow_half_days, created_at FROM leave_policies WHERE company_id = ${scope.company.company_id} ORDER BY created_at`,
        scope.sql`SELECT id, name, holiday_date::text AS date FROM holidays WHERE company_id = ${scope.company.company_id} ORDER BY holiday_date`,
        scope.sql`SELECT r.id, r.employment_id, r.leave_policy_id, r.start_date::text AS start_date, r.end_date::text AS end_date, r.duration_days, r.reason, r.status, r.entry_type, r.created_at,
             p.first_name, p.last_name, lp.name AS policy_name,
             author.role::text AS created_by_role, author_user.name AS created_by_name,
             reviewer.role::text AS reviewed_by_role, reviewer_user.name AS reviewed_by_name
          FROM leave_requests r JOIN employments e ON e.id = r.employment_id JOIN people p ON p.id = e.person_id JOIN leave_policies lp ON lp.id = r.leave_policy_id
          LEFT JOIN organization_memberships author ON author.id = r.created_by_membership_id
          LEFT JOIN "user" author_user ON author_user.id = author.app_user_id
          LEFT JOIN organization_memberships reviewer ON reviewer.id = r.reviewed_by_membership_id
          LEFT JOIN "user" reviewer_user ON reviewer_user.id = reviewer.app_user_id
          WHERE e.company_id = ${scope.company.company_id} ORDER BY r.created_at DESC`,
        scope.sql`SELECT e.id AS employment_id, e.start_date::text AS start_date, p.first_name, p.last_name FROM employments e JOIN people p ON p.id = e.person_id WHERE e.company_id = ${scope.company.company_id} AND e.status <> 'ended' ORDER BY p.first_name`,
      ])
      const today = new Date().toISOString().slice(0, 10)
      const balances = people.flatMap((person) => policies.map((policy) => ({
        employment_id: person.employment_id, policy_id: policy.id,
        ...leaveBalance(policy as Parameters<typeof leaveBalance>[0], String(person.start_date), requests.filter((item) => item.status === 'approved' && item.employment_id === person.employment_id && item.leave_policy_id === policy.id) as Parameters<typeof leaveBalance>[2], today),
      })))
      return apiJson({ policies, holidays, requests, people, balances, today })
    },
    POST: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'calendar', 'write')
      if ('error' in scope) return scope.error
      const body = await request.json().catch(() => null) as Action | null
      if (!body || !('action' in body)) return apiJson({ error: 'Invalid request.' }, 400)
      if (body.action === 'holiday') {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
        if (!name || !validDate(body.date)) return apiJson({ error: 'Enter a holiday name and date.' }, 400)
        try {
          const [holiday] = await scope.sql`INSERT INTO holidays (company_id, name, holiday_date) VALUES (${scope.company.company_id}, ${name}, ${body.date}::date) RETURNING id`
          return apiJson({ id: holiday.id }, 201)
        } catch (error) { if (isUnique(error)) return apiJson({ error: 'A holiday already exists on that date.' }, 409); throw error }
      }
      if (body.action === 'removeHoliday') {
        if (!validUuid(body.holidayId)) return apiJson({ error: 'Holiday not found.' }, 404)
        const removed = (await scope.sql`DELETE FROM holidays WHERE id = ${body.holidayId}::uuid AND company_id = ${scope.company.company_id} RETURNING id`).at(0)
        return removed ? apiJson({ ok: true }) : apiJson({ error: 'Holiday not found.' }, 404)
      }
      if (body.action === 'policy') {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
        const annual = Number(body.annualAllowance)
        const carry = Number(body.carryForwardLimit)
        if (!name || !Number.isFinite(annual) || annual < 0 || annual > 365 || !Number.isFinite(carry) || carry < 0 || carry > annual) return apiJson({ error: 'Enter a valid policy and allowance.' }, 400)
        const [policy] = await scope.sql`
          INSERT INTO leave_policies (company_id, name, annual_allowance, accrues, accrual_per_month, carry_forward_limit, allow_half_days)
          VALUES (${scope.company.company_id}, ${name}, ${annual}, ${Boolean(body.accrues)}, ${body.accrues ? annual / 12 : null}, ${carry}, ${Boolean(body.allowHalfDays)}) RETURNING id
        `
        return apiJson({ id: policy.id }, 201)
      }
      if (body.action === 'request' || body.action === 'recordLeave') {
        if (!validUuid(body.employmentId) || !validUuid(body.policyId) || !validDate(body.startDate) || !validDate(body.endDate)) return apiJson({ error: 'Select a person, leave type and valid dates.' }, 400)
        if (body.startDate.slice(0, 4) !== body.endDate.slice(0, 4)) return apiJson({ error: 'Split requests that cross calendar years.' }, 400)
        const dates = dateRange(body.startDate, body.endDate)
        if (!dates) return apiJson({ error: 'Date range must be within one year.' }, 400)
        if (body.action === 'recordLeave' && body.endDate > new Date().toISOString().slice(0, 10)) return apiJson({ error: 'Recorded leave must have already happened. Use a request for future dates.' }, 400)
        const [employment, policy, holidays] = await Promise.all([
          scope.sql`SELECT id, start_date::text AS start_date FROM employments WHERE id = ${body.employmentId}::uuid AND company_id = ${scope.company.company_id} AND status <> 'ended'`,
          scope.sql`SELECT id, allow_half_days FROM leave_policies WHERE id = ${body.policyId}::uuid AND company_id = ${scope.company.company_id}`,
          scope.sql`SELECT holiday_date::text AS date FROM holidays WHERE company_id = ${scope.company.company_id} AND holiday_date BETWEEN ${body.startDate}::date AND ${body.endDate}::date`,
        ])
        if (!employment.length || !policy.length) return apiJson({ error: 'Person or policy not found.' }, 404)
        if (body.startDate < String(employment[0].start_date)) return apiJson({ error: 'Leave cannot start before the joining date.' }, 400)
        const holidaySet = new Set(holidays.map((row) => String(row.date)))
        const workdays = dates.filter((date) => { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day !== 0 && day !== 6 && !holidaySet.has(date) }).length
        if (!workdays) return apiJson({ error: 'This period has no working days.' }, 400)
        if (body.halfDay && (!policy[0].allow_half_days || workdays !== 1 || dates.length !== 1)) return apiJson({ error: 'Half-days require an enabled policy and a single working day.' }, 400)
        const duration = body.halfDay ? 0.5 : workdays
        const overlapping = await scope.sql`SELECT id FROM leave_requests
          WHERE employment_id = ${body.employmentId}::uuid AND status IN ('pending', 'approved')
          AND start_date <= ${body.endDate}::date AND end_date >= ${body.startDate}::date LIMIT 1`
        if (overlapping.length) return apiJson({ error: 'This person already has a leave entry during these dates.' }, 409)
        const recorded = body.action === 'recordLeave'
        const [created] = await scope.sql`
          INSERT INTO leave_requests (employment_id, leave_policy_id, start_date, end_date, duration_days, reason, status, entry_type, created_by_membership_id, reviewed_by_membership_id, reviewed_at)
          VALUES (${body.employmentId}::uuid, ${body.policyId}::uuid, ${body.startDate}::date, ${body.endDate}::date, ${duration}, ${body.reason?.trim().slice(0, 500) || null},
            ${recorded ? 'approved' : 'pending'}::companyfollo_leave_request_status, ${recorded ? 'recorded' : 'request'}, ${scope.company.membership_id}::uuid,
            ${recorded ? scope.company.membership_id : null}::uuid, ${recorded ? new Date().toISOString() : null}::timestamptz) RETURNING id
        `
        return apiJson({ id: created.id }, 201)
      }
      if (body.action === 'cancel') {
        if (!validUuid(body.requestId)) return apiJson({ error: 'Request not found.' }, 404)
        const cancelled = (await scope.sql`
          UPDATE leave_requests r SET status = 'cancelled'::companyfollo_leave_request_status
          FROM employments e WHERE r.id = ${body.requestId}::uuid AND r.employment_id = e.id
            AND e.company_id = ${scope.company.company_id} AND r.status IN ('pending', 'approved') RETURNING r.id
        `).at(0)
        return cancelled ? apiJson({ ok: true }) : apiJson({ error: 'Request cannot be cancelled.' }, 409)
      }
      {
        if (!validUuid(body.requestId) || !['approved', 'declined'].includes(body.decision)) return apiJson({ error: 'Invalid review.' }, 400)
        const target = (await scope.sql`
          SELECT r.id, r.status, r.employment_id, r.leave_policy_id, r.duration_days, r.start_date::text AS start_date, e.start_date::text AS joined,
            lp.annual_allowance, lp.accrues, lp.carry_forward_limit, lp.created_at
          FROM leave_requests r JOIN employments e ON e.id = r.employment_id JOIN leave_policies lp ON lp.id = r.leave_policy_id
          WHERE r.id = ${body.requestId}::uuid AND e.company_id = ${scope.company.company_id} AND lp.company_id = ${scope.company.company_id}
        `).at(0)
        if (!target || target.status !== 'pending') return apiJson({ error: 'Pending request not found.' }, 404)
        if (body.decision === 'approved') {
          const usage = await scope.sql`
            SELECT start_date::text AS start_date, duration_days FROM leave_requests
            WHERE employment_id = ${target.employment_id} AND leave_policy_id = ${target.leave_policy_id} AND status = 'approved'
          `
          const balance = leaveBalance(target as Parameters<typeof leaveBalance>[0], String(target.joined), usage as Parameters<typeof leaveBalance>[2], String(target.start_date))
          if (Number(target.duration_days) > balance.available + 0.001) return apiJson({ error: `Not enough available leave (${Math.max(0, balance.available).toFixed(1)} days).` }, 409)
        }
        const updated = (await scope.sql`
          UPDATE leave_requests SET status = ${body.decision}::companyfollo_leave_request_status,
            reviewed_by_membership_id = ${scope.company.membership_id}::uuid, reviewed_at = now()
          WHERE id = ${body.requestId}::uuid AND status = 'pending' RETURNING id
        `).at(0)
        return updated ? apiJson({ ok: true }) : apiJson({ error: 'Request was already reviewed.' }, 409)
      }
      return apiJson({ error: 'Unknown action.' }, 400)
    },
  } },
})

function isUnique(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' }
