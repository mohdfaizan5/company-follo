import { createFileRoute } from '@tanstack/react-router'
import { requireCompanyAccess, validUuid } from '#/lib/server-workspace'

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export const Route = createFileRoute('/api/expenses')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'expenses', 'read')
        if ('error' in scope) return scope.error
        const url = new URL(request.url)
        const personId = url.searchParams.get('person')
        const rows = await scope.sql`
        SELECT x.id, x.label, x.amount, x.currency, x.incurred_on::text AS incurred_on, x.notes, x.created_at,
               p.id AS person_id, p.first_name, p.last_name, p.nickname
        FROM expenses x LEFT JOIN employments e ON e.id = x.employment_id LEFT JOIN people p ON p.id = e.person_id
        WHERE x.company_id = ${scope.company.company_id} AND (${personId}::uuid IS NULL OR p.id = ${personId}::uuid)
        ORDER BY x.incurred_on DESC, x.created_at DESC LIMIT 100`
        return json({ expenses: rows })
      },
      POST: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'expenses', 'write')
        if ('error' in scope) return scope.error
        const body = (await request.json().catch(() => null)) as {
          label?: string
          amount?: string
          currency?: string
          incurredOn?: string
          notes?: string
          employmentId?: string | null
        } | null
        const label = body?.label?.trim().slice(0, 120)
        const amount = String(body?.amount ?? '').trim()
        if (!label) return json({ error: 'Describe the expense.' }, 400)
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
          return json({ error: 'Enter a positive amount.' }, 400)
        const currency = body?.currency
        const incurredOn = body?.incurredOn
        if (currency !== 'INR' && currency !== 'USD')
          return json({ error: 'Choose INR or USD.' }, 400)
        if (!incurredOn || !/^\d{4}-\d{2}-\d{2}$/.test(incurredOn))
          return json({ error: 'Enter an incurred date.' }, 400)
        const employmentId = body?.employmentId || null
        if (
          employmentId &&
          (!validUuid(employmentId) ||
            !(
              await scope.sql`SELECT id FROM employments WHERE id = ${employmentId}::uuid AND company_id = ${scope.company.company_id}`
            ).length)
        )
          return json({ error: 'Choose a person in this company.' }, 400)
        const [expense] =
          await scope.sql`INSERT INTO expenses (company_id, employment_id, label, amount, currency, incurred_on, notes)
        VALUES (${scope.company.company_id}, ${employmentId}::uuid, ${label}, ${amount}::numeric, ${currency}::companyfollo_currency, ${incurredOn}::date, ${body?.notes?.trim().slice(0, 500) || null}) RETURNING id`
        return json({ expense }, 201)
      },
      DELETE: async ({ request }) => {
        const scope = await requireCompanyAccess(request, 'expenses', 'write')
        if ('error' in scope) return scope.error
        const id = new URL(request.url).searchParams.get('id')
        if (!id || !validUuid(id))
          return json({ error: 'Expense not found.' }, 404)
        const deleted = (
          await scope.sql`DELETE FROM expenses WHERE id = ${id}::uuid AND company_id = ${scope.company.company_id} RETURNING id`
        ).at(0)
        return deleted
          ? json({ ok: true })
          : json({ error: 'Expense not found.' }, 404)
      },
    },
  },
})
