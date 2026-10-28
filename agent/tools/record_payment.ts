import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

export default defineTool({
  description:
    'Record a salary, stipend, bonus, or reimbursement payment for a known employment ID. Ask the user for every financial field and require their confirmation.',
  inputSchema: z.object({
    employmentId: z.uuid(),
    amount: z.coerce.number().positive().max(999_999_999_999.99),
    currency: z.enum(['INR', 'USD']),
    type: z.enum(['Salary', 'Stipend', 'Bonus', 'Reimbursement']),
    status: z.enum(['draft', 'scheduled', 'paid']).default('draft'),
    paidOn: z.string().date().optional(),
    periodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    notes: z.string().trim().max(2_000).optional(),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `Record ${input.currency} ${input.amount.toLocaleString()} as ${input.type} (${input.status})?`,
  },
  async execute(input, ctx) {
    if (input.status === 'paid' && !input.paidOn) {
      throw new Error('A paid payment needs its payment date.')
    }

    const workspace = await getAgentResourceWorkspace(
      requireAgentUserId(ctx.session.auth.current?.principalId),
      'payroll',
      'write',
    )
    if (workspace.access === 'unavailable') return workspace

    const employment = (
      await workspace.sql`
        SELECT e.id, p.first_name, p.last_name
        FROM employments e JOIN people p ON p.id = e.person_id
        WHERE e.id = ${input.employmentId}::uuid AND e.company_id = ${workspace.companyId}::uuid
      `
    ).at(0)
    if (!employment) throw new Error('Choose a person in this company.')

    const periodStart = input.periodMonth ? `${input.periodMonth}-01` : null
    const periodEnd = input.periodMonth
      ? new Date(
          Date.UTC(
            Number(input.periodMonth.slice(0, 4)),
            Number(input.periodMonth.slice(5, 7)),
            0,
          ),
        )
          .toISOString()
          .slice(0, 10)
      : null

    const [payment] = await workspace.sql`
      INSERT INTO payments (employment_id, amount, currency, status, paid_on, notes, type, period_start, period_end)
      VALUES (${employment.id}, ${input.amount}::numeric, ${input.currency}::companyfollo_currency,
              ${input.status}::companyfollo_payment_status, ${input.status === 'paid' ? input.paidOn : null}::date,
              ${input.notes || null}, ${input.type}, ${periodStart}::date, ${periodEnd}::date)
      RETURNING id, amount, currency, status, paid_on::text AS paid_on, type
    `

    return {
      view: 'action_result',
      action: 'payment_recorded',
      message: `${input.type} payment was recorded for ${[employment.first_name, employment.last_name].filter(Boolean).join(' ')}.`,
      payrollUrl: '/dashboard/payroll',
      payment: {
        id: String(payment.id),
        amount: String(payment.amount),
        currency: String(payment.currency),
        status: String(payment.status),
        paidOn: payment.paid_on ? String(payment.paid_on) : null,
        type: String(payment.type),
      },
    }
  },
})
