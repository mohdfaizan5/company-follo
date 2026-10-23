import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, validUuid } from '#/lib/server-workspace'

type Body = { type?: 'compensation' | 'expense'; amount?: string; currency?: string; kind?: string; date?: string; label?: string; notes?: string }

// Adds a compensation record or an expense to one person. Payments are recorded from the Payroll page.
export const Route = createFileRoute('/api/people/$personId/records')({
  server: { handlers: {
    POST: async ({ request, params }) => {
      const body = await request.json().catch(() => null) as Body | null
      if (body?.type !== 'compensation' && body?.type !== 'expense') return apiJson({ error: 'Choose what to add.' }, 400)
      const scope = await requireCompanyAccess(request, body.type === 'compensation' ? 'payroll' : 'expenses', 'write')
      if ('error' in scope) return scope.error
      if (!validUuid(params.personId)) return apiJson({ error: 'Person not found.' }, 404)
      const amount = String(body.amount ?? '').trim()
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return apiJson({ error: 'Enter a positive amount with up to two decimals.' }, 400)
      if (body.currency !== 'INR' && body.currency !== 'USD') return apiJson({ error: 'Choose INR or USD.' }, 400)
      if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || Number.isNaN(Date.parse(body.date))) return apiJson({ error: 'Enter a valid date.' }, 400)
      const employment = (await scope.sql`SELECT e.id FROM employments e WHERE e.person_id = ${params.personId}::uuid AND e.company_id = ${scope.company.company_id} AND e.status <> 'ended' ORDER BY e.created_at DESC LIMIT 1`).at(0)
      if (!employment) return apiJson({ error: 'Person not found.' }, 404)
      const notes = body.notes?.trim().slice(0, 500) || null
      if (body.type === 'compensation') {
        if (!['salary', 'bonus', 'adjustment'].includes(body.kind ?? '')) return apiJson({ error: 'Choose a record type.' }, 400)
        await scope.sql`INSERT INTO compensation_records (employment_id, kind, amount, currency, effective_from, notes)
          VALUES (${employment.id}, ${body.kind}::companyfollo_compensation_kind, ${amount}, ${body.currency}::companyfollo_currency, ${body.date}::date, ${notes})`
      } else {
        const label = body.label?.trim().slice(0, 120)
        if (!label) return apiJson({ error: 'Describe the expense.' }, 400)
        await scope.sql`INSERT INTO expenses (company_id, employment_id, amount, currency, incurred_on, label, notes)
          VALUES (${scope.company.company_id}, ${employment.id}, ${amount}, ${body.currency}::companyfollo_currency, ${body.date}::date, ${label}, ${notes})`
      }
      return apiJson({ ok: true }, 201)
    },
  } },
})
