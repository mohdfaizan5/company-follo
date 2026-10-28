import { createFileRoute } from '@tanstack/react-router'
import { requireCompanyAccess } from '#/lib/server-workspace'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/payments')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'payroll', 'read')
        if ('error' in scope) return scope.error
        const sql = scope.sql
        const url = new URL(request.url)
        const requestedPage = Number(url.searchParams.get('page') ?? '1')
        const requestedPageSize = Number(
          url.searchParams.get('pageSize') ?? '10',
        )
        const page =
          Number.isInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1
        const pageSize = Number.isInteger(requestedPageSize)
          ? Math.min(50, Math.max(1, requestedPageSize))
          : 10
        const offset = (page - 1) * pageSize
        const [payments, count] = await Promise.all([
          sql`
          SELECT pay.id, pay.employment_id, pay.amount, pay.currency, pay.status, pay.paid_on::text AS paid_on, pay.notes, pay.created_at,
                 pay.type, pay.region, pay.period_start::text AS period_start, pay.period_end::text AS period_end, p.avatar_url,
                 p.id AS person_id, p.first_name, p.last_name, e.title
          FROM payments pay
          JOIN employments e ON e.id = pay.employment_id
          JOIN people p ON p.id = e.person_id
          WHERE e.company_id = ${scope.company.company_id}
          ORDER BY pay.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `,
          sql`SELECT COUNT(*)::int AS count FROM payments pay JOIN employments e ON e.id = pay.employment_id WHERE e.company_id = ${scope.company.company_id}`,
        ])
        return json({
          payments,
          page,
          pageSize,
          total: Number(count.at(0)?.count ?? 0),
        })
      },
      POST: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'payroll', 'write')
        if ('error' in scope) return scope.error
        const sql = scope.sql

        const body = (await request.json().catch(() => null)) as {
          employmentId?: string
          amount?: string
          currency?: string
          status?: string
          paidOn?: string
          notes?: string
          type?: string
          region?: string
          periodMonth?: string
        } | null
        const amount = String(body?.amount ?? '').trim()
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
          return json(
            { error: 'Enter a positive amount with up to two decimals.' },
            400,
          )
        if (body?.currency !== 'INR' && body?.currency !== 'USD')
          return json({ error: 'Choose INR or USD.' }, 400)
        const status =
          body.status === 'paid' || body.status === 'scheduled'
            ? body.status
            : 'draft'
        const paidOn = status === 'paid' ? body.paidOn : null
        if (
          status === 'paid' &&
          (!paidOn ||
            !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) ||
            Number.isNaN(Date.parse(paidOn)))
        )
          return json({ error: 'Enter the payment date.' }, 400)
        if (!body.employmentId) return json({ error: 'Choose a person.' }, 400)
        // Former people can still get a final settlement.
        const employment = (
          await sql`SELECT id FROM employments WHERE id = ${body.employmentId}::uuid AND company_id = ${scope.company.company_id}`
        ).at(0)
        if (!employment)
          return json({ error: 'Choose a person in this company.' }, 400)

        const type = body.type?.trim().slice(0, 40) || 'Salary'
        const region = body.region?.trim().slice(0, 60) || null
        // A pay month (YYYY-MM) becomes the first and last day of that month.
        const month = /^\d{4}-\d{2}$/.test(body.periodMonth ?? '')
          ? body.periodMonth!
          : null
        const periodStart = month ? `${month}-01` : null
        const periodEnd = month
          ? new Date(
              Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
            )
              .toISOString()
              .slice(0, 10)
          : null
        const [payment] = await sql`
          INSERT INTO payments (employment_id, amount, currency, status, paid_on, notes, type, region, period_start, period_end)
          VALUES (${employment.id}, ${amount}::numeric, ${body.currency}::companyfollo_currency,
                  ${status}::companyfollo_payment_status, ${paidOn}::date, ${body.notes?.trim() || null},
                  ${type}, ${region}, ${periodStart}::date, ${periodEnd}::date)
          RETURNING id
        `
        return json({ payment }, 201)
      },
      DELETE: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'payroll', 'write')
        if ('error' in scope) return scope.error
        const id = new URL(request.url).searchParams.get('id')
        if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
          return json({ error: 'Payment not found.' }, 404)
        const deleted = (
          await scope.sql`
          DELETE FROM payments pay
          USING employments e
          WHERE pay.id = ${id}::uuid AND pay.employment_id = e.id AND e.company_id = ${scope.company.company_id}
          RETURNING pay.id
        `
        ).at(0)
        return deleted
          ? json({ ok: true })
          : json({ error: 'Payment not found.' }, 404)
      },
    },
  },
})
