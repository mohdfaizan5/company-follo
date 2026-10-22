import { createFileRoute } from '@tanstack/react-router'
import { requireCompanyAccess } from '#/lib/server-workspace'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export const Route = createFileRoute('/api/people')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const context = await requireCompanyAccess(request, 'people', 'read')
        if ('error' in context) return context.error
        const people = await context.sql`
          SELECT p.id, p.first_name, p.last_name, p.work_email, p.phone_number,
                 e.id AS employment_id, e.title, e.department, e.level, e.start_date::text AS start_date, e.status,
                 e.manager_employment_id
          FROM employments e
          JOIN people p ON p.id = e.person_id
          WHERE e.company_id = ${context.company.company_id} AND e.status <> 'ended'
          ORDER BY e.start_date ASC, p.first_name ASC
        `
        return json({ people })
      },
      POST: async ({ request }) => {
        const context = await requireCompanyAccess(request, 'people', 'write')
        if ('error' in context) return context.error
        const body = await request.json().catch(() => null) as { name?: string; role?: string; email?: string; personalEmail?: string; startDate?: string; managerEmploymentId?: string } | null
        const name = body?.name?.trim()
        const title = body?.role?.trim()
        if (!name || !title) return json({ error: 'Name and role are required.' }, 400)
        const email = body?.email?.trim().toLowerCase() || null
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid work email.' }, 400)
        const personalEmail = body?.personalEmail?.trim().toLowerCase() || null
        if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) return json({ error: 'Enter a valid personal email.' }, 400)
        const startDate = body?.startDate || new Date().toISOString().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate))) return json({ error: 'Enter a valid joining date.' }, 400)
        const managerId = body?.managerEmploymentId || null
        if (managerId) {
          const manager = (await context.sql`
            SELECT id FROM employments WHERE id = ${managerId}::uuid AND company_id = ${context.company.company_id} AND status <> 'ended'
          `).at(0)
          if (!manager) return json({ error: 'Choose a person from this company as manager.' }, 400)
        }
        const [firstName, ...lastName] = name.split(/\s+/)
        try {
          const [person] = await context.sql`
            WITH created_person AS (
              INSERT INTO people (organization_id, first_name, last_name, work_email, personal_email)
              VALUES (${context.company.organization_id}, ${firstName}, ${lastName.join(' ') || null}, ${email}, ${personalEmail})
              RETURNING id, first_name, last_name, work_email
            ), created_employment AS (
              INSERT INTO employments (person_id, company_id, title, start_date, manager_employment_id)
              SELECT id, ${context.company.company_id}, ${title}, ${startDate}::date, ${managerId}::uuid
              FROM created_person
              RETURNING id, person_id, title, start_date, status, manager_employment_id
            )
            SELECT p.id, p.first_name, p.last_name, p.work_email,
                   e.id AS employment_id, e.title, e.start_date::text AS start_date, e.status, e.manager_employment_id
            FROM created_person p JOIN created_employment e ON e.person_id = p.id
          `
          return json({ person }, 201)
        } catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
            return json({ error: 'That work email is already used in this organization.' }, 409)
          }
          throw error
        }
      },
    },
  },
})
