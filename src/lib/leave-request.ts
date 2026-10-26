import type { NeonQueryFunction } from '@neondatabase/serverless'
import { apiJson, validDate, validUuid } from '#/lib/server-workspace'

export type LeaveInput = { employmentId: string; policyId: string; startDate: string; endDate: string; halfDay?: boolean; reason?: string }

function dateRange(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  if (endMs < startMs || endMs - startMs > 366 * 86400000) return null
  const dates: string[] = []
  for (let ms = startMs; ms <= endMs; ms += 86400000) dates.push(new Date(ms).toISOString().slice(0, 10))
  return dates
}

/**
 * Validates and saves one leave entry. `recorded` entries are past leave entered by HR and saved as approved;
 * everything else is a pending request. Returns an API response either way.
 */
export async function createLeave(sql: NeonQueryFunction<false, false>, companyId: string, membershipId: string, body: LeaveInput, recorded: boolean) {
  if (!validUuid(body.employmentId) || !validUuid(body.policyId) || !validDate(body.startDate) || !validDate(body.endDate)) return apiJson({ error: 'Select a person, leave type and valid dates.' }, 400)
  if (body.startDate.slice(0, 4) !== body.endDate.slice(0, 4)) return apiJson({ error: 'Split requests that cross calendar years.' }, 400)
  const dates = dateRange(body.startDate, body.endDate)
  if (!dates) return apiJson({ error: 'Date range must be within one year.' }, 400)
  if (recorded && body.endDate > new Date().toISOString().slice(0, 10)) return apiJson({ error: 'Recorded leave must have already happened. Use a request for future dates.' }, 400)
  const [employment, policy, holidays, company] = await Promise.all([
    sql`SELECT id, start_date::text AS start_date FROM employments WHERE id = ${body.employmentId}::uuid AND company_id = ${companyId} AND status <> 'ended'`,
    sql`SELECT id, allow_half_days FROM leave_policies WHERE id = ${body.policyId}::uuid AND company_id = ${companyId}`,
    sql`SELECT holiday_date::text AS date FROM holidays WHERE company_id = ${companyId} AND holiday_date BETWEEN ${body.startDate}::date AND ${body.endDate}::date`,
    sql`SELECT working_days FROM companies WHERE id = ${companyId}`,
  ])
  if (!employment.length || !policy.length) return apiJson({ error: 'Person or leave type not found.' }, 404)
  if (body.startDate < String(employment[0].start_date)) return apiJson({ error: 'Leave cannot start before the joining date.' }, 400)
  const holidaySet = new Set(holidays.map((row) => String(row.date)))
  const workingDays = new Set<number>(company.at(0)?.working_days ?? [1, 2, 3, 4, 5, 6])
  const workdays = dates.filter((date) => workingDays.has(new Date(`${date}T00:00:00Z`).getUTCDay()) && !holidaySet.has(date)).length
  if (!workdays) return apiJson({ error: 'This period has no working days.' }, 400)
  if (body.halfDay && (!policy[0].allow_half_days || workdays !== 1 || dates.length !== 1)) return apiJson({ error: 'Half-days need a leave type that allows them and a single working day.' }, 400)
  const duration = body.halfDay ? 0.5 : workdays
  const overlapping = await sql`SELECT id FROM leave_requests
    WHERE employment_id = ${body.employmentId}::uuid AND status IN ('pending', 'approved')
    AND start_date <= ${body.endDate}::date AND end_date >= ${body.startDate}::date LIMIT 1`
  if (overlapping.length) return apiJson({ error: 'There is already leave during these dates.' }, 409)
  const [created] = await sql`
    INSERT INTO leave_requests (employment_id, leave_policy_id, start_date, end_date, duration_days, reason, status, entry_type, created_by_membership_id, reviewed_by_membership_id, reviewed_at)
    VALUES (${body.employmentId}::uuid, ${body.policyId}::uuid, ${body.startDate}::date, ${body.endDate}::date, ${duration}, ${body.reason?.trim().slice(0, 500) || null},
      ${recorded ? 'approved' : 'pending'}::companyfollo_leave_request_status, ${recorded ? 'recorded' : 'request'}, ${membershipId}::uuid,
      ${recorded ? membershipId : null}::uuid, ${recorded ? new Date().toISOString() : null}::timestamptz) RETURNING id
  `
  return apiJson({ id: created.id }, 201)
}
