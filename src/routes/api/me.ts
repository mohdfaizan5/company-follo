import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireMember, validUuid } from '#/lib/server-workspace'
import { createLeave } from '#/lib/leave-request'
import { leaveBalance } from '#/lib/leave-balance'

type Member = Exclude<Awaited<ReturnType<typeof requireMember>>, { error: Response }>

/** The person record is linked through the invitation they accepted, or failing that their work email. */
async function findPerson({ sql, company, userId, email }: Member) {
  return (await sql`
    SELECT p.id, p.first_name, p.last_name, p.work_email, p.personal_email, p.phone_number, p.address, p.avatar_url,
           e.id AS employment_id, e.title, e.department, e.level, e.start_date::text AS start_date
    FROM people p
    JOIN employments e ON e.person_id = p.id AND e.company_id = ${company.company_id} AND e.status <> 'ended'
    WHERE p.organization_id = ${company.organization_id} AND (
      p.id IN (SELECT person_id FROM person_invitations WHERE accepted_by_user_id = ${userId})
      OR lower(p.work_email) = lower(${email})
    )
    ORDER BY (p.id IN (SELECT person_id FROM person_invitations WHERE accepted_by_user_id = ${userId})) DESC
    LIMIT 1`).at(0) ?? null
}

/**
 * A signed-in person's own record: profile, leave, upcoming holidays, published docs and their payments.
 * It never returns anything about other people, so every role can use it.
 */
export const Route = createFileRoute('/api/me')({
  server: { handlers: {
    GET: async ({ request }) => {
      const scope = await requireMember(request)
      if ('error' in scope) return scope.error
      const { sql, company } = scope
      const companyId = company.company_id
      const today = new Date().toISOString().slice(0, 10)

      const person = await findPerson(scope)

      const [holidays, docs] = await Promise.all([
        sql`SELECT id, name, kind, holiday_date::text AS date FROM holidays WHERE company_id = ${companyId} AND holiday_date >= date_trunc('year', CURRENT_DATE) ORDER BY holiday_date`,
        sql`SELECT id, title, kind, visibility, updated_at FROM handbook_documents WHERE company_id = ${companyId} AND status = 'published' ORDER BY kind, title`,
      ])
      const base = {
        company: { name: company.company_name, logo_url: company.logo_url, currency: company.default_currency, working_days: company.working_days, role: company.role },
        holidays, docs, today, person,
      }
      const leaveTypes = await sql`SELECT id, name, category, allow_half_days FROM leave_policies WHERE company_id = ${companyId} ORDER BY created_at`
      if (!person) return apiJson({ ...base, leaveTypes, leave: [], balances: [], payments: [] })

      const [leave, policies, payments] = await Promise.all([
        sql`SELECT r.id, r.leave_policy_id, r.start_date::text AS start_date, r.end_date::text AS end_date, r.duration_days, r.reason, r.status, r.entry_type,
                   lp.name AS policy_name, lp.category AS policy_category
            FROM leave_requests r JOIN leave_policies lp ON lp.id = r.leave_policy_id
            WHERE r.employment_id = ${person.employment_id} AND r.status <> 'cancelled'
            ORDER BY r.start_date DESC`,
        sql`SELECT id, name, annual_allowance, accrues, carry_forward_limit, created_at FROM leave_policies WHERE company_id = ${companyId} AND category = 'paid' ORDER BY created_at`,
        // Drafts are HR's working notes; a person sees payments once they are scheduled or paid.
        sql`SELECT id, amount, currency, status, paid_on::text AS paid_on, period_start::text AS period_start, period_end::text AS period_end, notes, created_at
            FROM payments WHERE employment_id = ${person.employment_id} AND status IN ('scheduled', 'paid')
            ORDER BY COALESCE(paid_on, period_end, created_at::date) DESC`,
      ])
      const balances = policies.map((policy) => ({
        policy_id: policy.id, name: policy.name,
        ...leaveBalance(policy as Parameters<typeof leaveBalance>[0], String(person.start_date),
          leave.filter((item) => item.status === 'approved' && item.leave_policy_id === policy.id) as Parameters<typeof leaveBalance>[2], today),
      }))
      return apiJson({ ...base, leaveTypes, leave, balances, payments })
    },
    POST: async ({ request }) => {
      const scope = await requireMember(request)
      if ('error' in scope) return scope.error
      const person = await findPerson(scope)
      if (!person) return apiJson({ error: 'Your profile is not linked yet. Ask HR.' }, 404)
      const body = await request.json().catch(() => null) as { action?: string; policyId?: string; startDate?: string; endDate?: string; halfDay?: boolean; reason?: string; requestId?: string } | null
      if (body?.action === 'requestLeave') {
        // People asking for their own time off always say why; HR sees the reason when reviewing.
        if (!body.reason?.trim()) return apiJson({ error: 'Add a reason for your request.' }, 400)
        return createLeave(scope.sql, String(scope.company.company_id), String(scope.company.membership_id),
          { employmentId: String(person.employment_id), policyId: body.policyId ?? '', startDate: body.startDate ?? '', endDate: body.endDate || body.startDate || '', halfDay: body.halfDay, reason: body.reason }, false)
      }
      if (body?.action === 'cancelRequest') {
        if (!validUuid(body.requestId ?? '')) return apiJson({ error: 'Request not found.' }, 404)
        const cancelled = (await scope.sql`UPDATE leave_requests SET status = 'cancelled'::companyfollo_leave_request_status
          WHERE id = ${body.requestId}::uuid AND employment_id = ${person.employment_id} AND status = 'pending' RETURNING id`).at(0)
        return cancelled ? apiJson({ ok: true }) : apiJson({ error: 'Only requests still awaiting approval can be cancelled.' }, 409)
      }
      return apiJson({ error: 'Unknown action.' }, 400)
    },
  } },
})
