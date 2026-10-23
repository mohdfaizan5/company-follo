import { createFileRoute } from '@tanstack/react-router'
import { hasCompanyPermission, requireCompanyAccess } from '#/lib/server-workspace'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export const Route = createFileRoute('/api/people/$personId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const scope = await requireCompanyAccess(request, 'people', 'read')
        if ('error' in scope) return scope.error
        if (!/^[0-9a-f-]{36}$/i.test(params.personId)) return json({ error: 'Person not found.' }, 404)
        const sql = scope.sql
        const person = (await sql`
          SELECT p.id, p.organization_id, p.first_name, p.last_name, p.work_email, p.phone_number, p.personal_email, p.address, p.avatar_url, p.notes,
                 e.id AS employment_id, e.title, e.department, e.level, e.start_date::text AS start_date, e.status,
                 e.manager_employment_id, manager_person.first_name AS manager_first_name,
                 manager_person.last_name AS manager_last_name, c.id AS company_id, c.name AS company_name
          FROM people p
          JOIN employments e ON e.person_id = p.id
          JOIN companies c ON c.id = e.company_id
          LEFT JOIN employments manager ON manager.id = e.manager_employment_id
          LEFT JOIN people manager_person ON manager_person.id = manager.person_id
          WHERE p.id = ${params.personId}::uuid AND c.id = ${scope.company.company_id}
          ORDER BY e.created_at DESC LIMIT 1
        `).at(0)
        if (!person) return json({ error: 'Person not found.' }, 404)
        const [payrollAllowed, expensesAllowed] = await Promise.all([hasCompanyPermission(scope, 'payroll', 'read'), hasCompanyPermission(scope, 'expenses', 'read')])
        const [compensation, payments, expenses, documents] = await Promise.all([
          payrollAllowed ? sql`SELECT id, kind, amount, currency, effective_from::text AS effective_from, notes FROM compensation_records WHERE employment_id = ${person.employment_id} ORDER BY effective_from DESC` : Promise.resolve([]),
          payrollAllowed ? sql`SELECT id, amount, currency, status, paid_on::text AS paid_on, created_at, notes FROM payments WHERE employment_id = ${person.employment_id} ORDER BY created_at DESC` : Promise.resolve([]),
          expensesAllowed ? sql`SELECT id, label, amount, currency, incurred_on::text AS incurred_on, notes FROM expenses WHERE employment_id = ${person.employment_id} ORDER BY incurred_on DESC` : Promise.resolve([]),
          sql`SELECT id, kind, file_name, display_name, created_at FROM documents WHERE person_id = ${person.id} AND organization_id = ${person.organization_id} ORDER BY created_at DESC`,
        ])
        const canWritePeople = await hasCompanyPermission(scope, 'people', 'write')
        const invitationRow = (await sql`SELECT expires_at, accepted_at FROM person_invitations WHERE person_id = ${person.id} AND company_id = ${scope.company.company_id}`).at(0)
        const invitation = !invitationRow ? 'none' : invitationRow.accepted_at ? 'accepted' : new Date(invitationRow.expires_at) < new Date() ? 'expired' : 'pending'
        return json({ person, invitation, compensation, payments, expenses, documents, uploadsEnabled: Boolean(process.env.UPLOADTHING_TOKEN) && canWritePeople, canWritePeople, payrollAllowed, expensesAllowed })
      },
      PATCH: async ({ request, params }) => {
        const scope = await requireCompanyAccess(request, 'people', 'write')
        if ('error' in scope) return scope.error
        if (!/^[0-9a-f-]{36}$/i.test(params.personId)) return json({ error: 'Person not found.' }, 404)
        const sql = scope.sql
        const person = (await sql`
          SELECT p.id, e.id AS employment_id
          FROM people p JOIN employments e ON e.person_id = p.id
          JOIN companies c ON c.id = e.company_id
          WHERE p.id = ${params.personId}::uuid AND c.id = ${scope.company.company_id} ORDER BY e.created_at DESC LIMIT 1
        `).at(0)
        if (!person) return json({ error: 'Person not found.' }, 404)

        const body = await request.json().catch(() => null) as { name?: string; title?: string; email?: string; phone?: string; personalEmail?: string; address?: string; notes?: string; department?: string; level?: string; startDate?: string; managerEmploymentId?: string | null } | null
        const name = body?.name?.trim()
        const title = body?.title?.trim()
        if (!name || !title) return json({ error: 'Name and role are required.' }, 400)
        const email = body?.email?.trim().toLowerCase() || null
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid work email.' }, 400)
        const personalEmail = body?.personalEmail?.trim().toLowerCase() || null
        if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) return json({ error: 'Enter a valid personal email.' }, 400)
        if (!body?.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || Number.isNaN(Date.parse(body.startDate))) return json({ error: 'Enter a valid joining date.' }, 400)
        // Only touch the manager when the client sent the field, so partial edits (like saving a note) keep the reporting line.
        if (body && 'managerEmploymentId' in body) {
          const managerId = body.managerEmploymentId || null
          if (managerId) {
            if (!/^[0-9a-f-]{36}$/i.test(managerId)) return json({ error: 'Choose a person from this company as manager.' }, 400)
            if (managerId === person.employment_id) return json({ error: 'A person cannot report to themselves.' }, 400)
            const manager = (await sql`SELECT id FROM employments WHERE id = ${managerId}::uuid AND company_id = ${scope.company.company_id} AND status <> 'ended'`).at(0)
            if (!manager) return json({ error: 'Choose a person from this company as manager.' }, 400)
            // Walk up from the proposed manager; if we reach this person, the change would create a reporting loop.
            const loop = (await sql`
              WITH RECURSIVE chain AS (
                SELECT id, manager_employment_id FROM employments WHERE id = ${managerId}::uuid
                UNION
                SELECT e.id, e.manager_employment_id FROM employments e JOIN chain c ON e.id = c.manager_employment_id
              ) SELECT 1 FROM chain WHERE id = ${person.employment_id}::uuid LIMIT 1
            `).at(0)
            if (loop) return json({ error: 'That would create a reporting loop.' }, 400)
          }
          await sql`UPDATE employments SET manager_employment_id = ${managerId}::uuid, updated_at = now() WHERE id = ${person.employment_id}`
        }
        const [firstName, ...lastName] = name.split(/\s+/)
        try {
          await sql`
            WITH updated_person AS (
              UPDATE people SET first_name = ${firstName}, last_name = ${lastName.join(' ') || null},
                work_email = ${email}, phone_number = ${body.phone?.trim() || null}, personal_email = ${personalEmail}, address = ${body.address?.trim() || null},
                notes = ${body.notes?.trim() || null}, updated_at = now()
              WHERE id = ${person.id} RETURNING id
            ), updated_employment AS (
              UPDATE employments SET title = ${title}, department = ${body.department?.trim() || null},
                level = ${body.level?.trim() || null}, start_date = ${body.startDate}::date, updated_at = now()
              WHERE id = ${person.employment_id} RETURNING id
            ) SELECT updated_person.id FROM updated_person, updated_employment
          `
          return json({ ok: true })
        } catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return json({ error: 'That work email is already used in this organization.' }, 409)
          throw error
        }
      },
    },
  },
})
