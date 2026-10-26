import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, validDate, validUuid } from '#/lib/server-workspace'
import { createLeave } from '#/lib/leave-request'
import { leaveBalance } from '#/lib/leave-balance'

type Category = 'paid' | 'unpaid' | 'wfh'
type PolicyInput = { name: string; category: Category; annualAllowance: number; accrues: boolean; carryForwardLimit: number; allowHalfDays: boolean }
type Action =
  | { action: 'holiday'; name: string; date: string; kind?: string }
  | { action: 'updateHoliday'; holidayId: string; name: string; date: string; kind?: string }
  | { action: 'removeHoliday'; holidayId: string }
  | ({ action: 'policy' } & PolicyInput)
  | ({ action: 'updatePolicy'; policyId: string } & PolicyInput)
  | { action: 'removePolicy'; policyId: string }
  | { action: 'request'; employmentId: string; policyId: string; startDate: string; endDate: string; halfDay: boolean; reason?: string }
  | { action: 'recordLeave'; employmentId: string; policyId: string; startDate: string; endDate: string; halfDay: boolean; reason?: string }
  | { action: 'review'; requestId: string; decision: 'approved' | 'declined' }
  | { action: 'cancel'; requestId: string }

function parsePolicy(body: PolicyInput) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const category: Category = body.category === 'unpaid' || body.category === 'wfh' ? body.category : 'paid'
  // Only paid leave has a balance; unpaid leave and WFH are just recorded.
  const annual = category === 'paid' ? Number(body.annualAllowance) : 0
  const carry = category === 'paid' ? Number(body.carryForwardLimit) : 0
  if (!name || !Number.isFinite(annual) || annual < 0 || annual > 365 || !Number.isFinite(carry) || carry < 0 || carry > annual) return null
  const accrues = category === 'paid' && Boolean(body.accrues)
  return { name, category, annual, carry, accrues, accrual: accrues ? annual / 12 : null, half: Boolean(body.allowHalfDays) }
}

export const Route = createFileRoute('/api/time-off')({
  server: { handlers: {
    GET: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'calendar', 'read')
      if ('error' in scope) return scope.error
      const companyId = scope.company.company_id
      const [policies, holidays, requests, people, company] = await Promise.all([
        scope.sql`SELECT id, name, category, annual_allowance, accrues, accrual_per_month, carry_forward_limit, allow_half_days, created_at FROM leave_policies WHERE company_id = ${companyId} ORDER BY created_at`,
        scope.sql`SELECT id, name, kind, holiday_date::text AS date FROM holidays WHERE company_id = ${companyId} ORDER BY holiday_date`,
        scope.sql`SELECT r.id, r.employment_id, r.leave_policy_id, r.start_date::text AS start_date, r.end_date::text AS end_date, r.duration_days, r.reason, r.status, r.entry_type, r.created_at,
             p.first_name, p.last_name, p.avatar_url, lp.name AS policy_name, lp.category AS policy_category,
             author.role::text AS created_by_role, author_user.name AS created_by_name
          FROM leave_requests r JOIN employments e ON e.id = r.employment_id JOIN people p ON p.id = e.person_id JOIN leave_policies lp ON lp.id = r.leave_policy_id
          LEFT JOIN organization_memberships author ON author.id = r.created_by_membership_id
          LEFT JOIN "user" author_user ON author_user.id = author.app_user_id
          WHERE e.company_id = ${companyId} ORDER BY r.start_date DESC`,
        scope.sql`SELECT e.id AS employment_id, e.start_date::text AS start_date, e.title, p.first_name, p.last_name, p.avatar_url FROM employments e JOIN people p ON p.id = e.person_id WHERE e.company_id = ${companyId} AND e.status <> 'ended' ORDER BY p.first_name`,
        scope.sql`SELECT working_days FROM companies WHERE id = ${companyId}`,
      ])
      const today = new Date().toISOString().slice(0, 10)
      const balances = people.flatMap((person) => policies.filter((policy) => policy.category === 'paid').map((policy) => ({
        employment_id: person.employment_id, policy_id: policy.id,
        ...leaveBalance(policy as Parameters<typeof leaveBalance>[0], String(person.start_date), requests.filter((item) => item.status === 'approved' && item.employment_id === person.employment_id && item.leave_policy_id === policy.id) as Parameters<typeof leaveBalance>[2], today),
      })))
      return apiJson({ policies, holidays, requests, people, balances, today, workingDays: company.at(0)?.working_days ?? [1, 2, 3, 4, 5, 6] })
    },
    POST: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'calendar', 'write')
      if ('error' in scope) return scope.error
      const companyId = scope.company.company_id
      const body = await request.json().catch(() => null) as Action | null
      if (!body || !('action' in body)) return apiJson({ error: 'Invalid request.' }, 400)
      const actions: string[] = ['holiday', 'updateHoliday', 'removeHoliday', 'policy', 'updatePolicy', 'removePolicy', 'request', 'recordLeave', 'cancel', 'review']
      if (!actions.includes(body.action)) return apiJson({ error: 'Unknown action.' }, 400)

      if (body.action === 'holiday' || body.action === 'updateHoliday') {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
        const kind = body.kind === 'public' ? 'public' : 'company'
        if (!name || !validDate(body.date)) return apiJson({ error: 'Enter a holiday name and date.' }, 400)
        try {
          if (body.action === 'holiday') {
            const [holiday] = await scope.sql`INSERT INTO holidays (company_id, name, kind, holiday_date) VALUES (${companyId}, ${name}, ${kind}, ${body.date}::date) RETURNING id`
            return apiJson({ id: holiday.id }, 201)
          }
          if (!validUuid(body.holidayId)) return apiJson({ error: 'Holiday not found.' }, 404)
          const updated = (await scope.sql`UPDATE holidays SET name = ${name}, kind = ${kind}, holiday_date = ${body.date}::date WHERE id = ${body.holidayId}::uuid AND company_id = ${companyId} RETURNING id`).at(0)
          return updated ? apiJson({ ok: true }) : apiJson({ error: 'Holiday not found.' }, 404)
        } catch (error) { if (isUnique(error)) return apiJson({ error: 'A holiday already exists on that date.' }, 409); throw error }
      }
      if (body.action === 'removeHoliday') {
        if (!validUuid(body.holidayId)) return apiJson({ error: 'Holiday not found.' }, 404)
        const removed = (await scope.sql`DELETE FROM holidays WHERE id = ${body.holidayId}::uuid AND company_id = ${companyId} RETURNING id`).at(0)
        return removed ? apiJson({ ok: true }) : apiJson({ error: 'Holiday not found.' }, 404)
      }
      if (body.action === 'policy' || body.action === 'updatePolicy') {
        const policy = parsePolicy(body)
        if (!policy) return apiJson({ error: 'Enter a valid policy and allowance.' }, 400)
        if (body.action === 'policy') {
          const [created] = await scope.sql`
            INSERT INTO leave_policies (company_id, name, category, annual_allowance, accrues, accrual_per_month, carry_forward_limit, allow_half_days)
            VALUES (${companyId}, ${policy.name}, ${policy.category}, ${policy.annual}, ${policy.accrues}, ${policy.accrual}, ${policy.carry}, ${policy.half}) RETURNING id`
          return apiJson({ id: created.id }, 201)
        }
        if (!validUuid(body.policyId)) return apiJson({ error: 'Policy not found.' }, 404)
        const updated = (await scope.sql`
          UPDATE leave_policies SET name = ${policy.name}, category = ${policy.category}, annual_allowance = ${policy.annual}, accrues = ${policy.accrues},
            accrual_per_month = ${policy.accrual}, carry_forward_limit = ${policy.carry}, allow_half_days = ${policy.half}
          WHERE id = ${body.policyId}::uuid AND company_id = ${companyId} RETURNING id`).at(0)
        return updated ? apiJson({ ok: true }) : apiJson({ error: 'Policy not found.' }, 404)
      }
      if (body.action === 'removePolicy') {
        if (!validUuid(body.policyId)) return apiJson({ error: 'Policy not found.' }, 404)
        const used = await scope.sql`SELECT 1 FROM leave_requests WHERE leave_policy_id = ${body.policyId}::uuid LIMIT 1`
        if (used.length) return apiJson({ error: 'This leave type has leave recorded against it. Rename it instead of deleting.' }, 409)
        const removed = (await scope.sql`DELETE FROM leave_policies WHERE id = ${body.policyId}::uuid AND company_id = ${companyId} RETURNING id`).at(0)
        return removed ? apiJson({ ok: true }) : apiJson({ error: 'Policy not found.' }, 404)
      }
      if (body.action === 'request' || body.action === 'recordLeave') {
        return createLeave(scope.sql, companyId, String(scope.company.membership_id), body, body.action === 'recordLeave')
      }
      if (body.action === 'cancel') {
        if (!validUuid(body.requestId)) return apiJson({ error: 'Request not found.' }, 404)
        const cancelled = (await scope.sql`
          UPDATE leave_requests r SET status = 'cancelled'::companyfollo_leave_request_status
          FROM employments e WHERE r.id = ${body.requestId}::uuid AND r.employment_id = e.id
            AND e.company_id = ${companyId} AND r.status IN ('pending', 'approved') RETURNING r.id
        `).at(0)
        return cancelled ? apiJson({ ok: true }) : apiJson({ error: 'Request cannot be cancelled.' }, 409)
      }
      // Only 'review' is left at this point.
      {
        if (!validUuid(body.requestId) || !['approved', 'declined'].includes(body.decision)) return apiJson({ error: 'Invalid review.' }, 400)
        const target = (await scope.sql`
          SELECT r.id, r.status, r.employment_id, r.leave_policy_id, r.duration_days, r.start_date::text AS start_date, e.start_date::text AS joined,
            lp.category, lp.annual_allowance, lp.accrues, lp.carry_forward_limit, lp.created_at
          FROM leave_requests r JOIN employments e ON e.id = r.employment_id JOIN leave_policies lp ON lp.id = r.leave_policy_id
          WHERE r.id = ${body.requestId}::uuid AND e.company_id = ${companyId} AND lp.company_id = ${companyId}
        `).at(0)
        if (!target || target.status !== 'pending') return apiJson({ error: 'Pending request not found.' }, 404)
        if (body.decision === 'approved' && target.category === 'paid') {
          const usage = await scope.sql`
            SELECT start_date::text AS start_date, duration_days FROM leave_requests
            WHERE employment_id = ${target.employment_id} AND leave_policy_id = ${target.leave_policy_id} AND status = 'approved'
          `
          const balance = leaveBalance(target as Parameters<typeof leaveBalance>[0], String(target.joined), usage as Parameters<typeof leaveBalance>[2], String(target.start_date))
          if (Number(target.duration_days) > balance.available + 0.001) return apiJson({ error: `Not enough paid leave available (${Math.max(0, balance.available).toFixed(1)} days). Record it as unpaid leave instead.` }, 409)
        }
        const updated = (await scope.sql`
          UPDATE leave_requests SET status = ${body.decision}::companyfollo_leave_request_status,
            reviewed_by_membership_id = ${scope.company.membership_id}::uuid, reviewed_at = now()
          WHERE id = ${body.requestId}::uuid AND status = 'pending' RETURNING id
        `).at(0)
        return updated ? apiJson({ ok: true }) : apiJson({ error: 'Request was already reviewed.' }, 409)
      }
    },
  } },
})

function isUnique(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' }
