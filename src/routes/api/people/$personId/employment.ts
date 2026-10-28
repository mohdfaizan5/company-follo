import { createFileRoute } from '@tanstack/react-router'
import { UTApi } from 'uploadthing/server'
import { apiJson, requireCompanyAccess, validDate, validUuid } from '#/lib/server-workspace'

const REASONS = ['resigned', 'let_go', 'contract_ended', 'internship_ended', 'other']

/**
 * Ending and restoring someone's employment. Nothing is deleted when a person leaves: the employment is marked
 * ended (which hides it from People, Calendar and pickers), open requests are closed and their login loses access.
 * DELETE is the one place records are removed for good, and only for people who have already left.
 */
export const Route = createFileRoute('/api/people/$personId/employment')({
  server: { handlers: {
    POST: async ({ request, params }) => {
      const scope = await requireCompanyAccess(request, 'people', 'write')
      if ('error' in scope) return scope.error
      if (!validUuid(params.personId)) return apiJson({ error: 'Person not found.' }, 404)
      const { sql } = scope
      const companyId = scope.company.company_id
      const body = await request.json().catch(() => null) as { action?: string; endDate?: string; reason?: string; note?: string; reassignTo?: string | null } | null
      const employment = (await sql`
        SELECT e.id, e.status, e.start_date::text AS start_date, e.manager_employment_id, p.organization_id
        FROM employments e JOIN people p ON p.id = e.person_id
        WHERE e.person_id = ${params.personId}::uuid AND e.company_id = ${companyId}
        ORDER BY e.created_at DESC LIMIT 1`).at(0)
      if (!employment) return apiJson({ error: 'Person not found.' }, 404)
      // The workspace login linked to this person through an accepted invitation, if any.
      const login = (await sql`
        SELECT m.id, m.role FROM person_invitations i
        JOIN organization_memberships m ON m.app_user_id = i.accepted_by_user_id AND m.organization_id = i.organization_id
        WHERE i.person_id = ${params.personId}::uuid`).at(0)

      if (body?.action === 'end') {
        if (employment.status === 'ended') return apiJson({ error: 'This person has already left.' }, 409)
        const today = new Date().toISOString().slice(0, 10)
        const endDate = body.endDate ?? ''
        if (!validDate(endDate) || endDate < String(employment.start_date)) return apiJson({ error: 'Choose a last working day on or after their joining date.' }, 400)
        if (endDate > today) return apiJson({ error: 'The last working day can’t be in the future yet. Record it on or after that day.' }, 400)
        if (!REASONS.includes(body.reason ?? '')) return apiJson({ error: 'Choose why they are leaving.' }, 400)
        if (login?.role === 'owner') return apiJson({ error: 'The workspace owner can’t be let go.' }, 409)
        if (login?.id === scope.company.membership_id) return apiJson({ error: 'You can’t end your own employment.' }, 409)
        // Direct reports move to the chosen person, or up to the leaver's own manager.
        let newManager: string | null = employment.manager_employment_id ? String(employment.manager_employment_id) : null
        if (body.reassignTo) {
          if (!validUuid(body.reassignTo) || body.reassignTo === employment.id) return apiJson({ error: 'Choose someone else for their reports.' }, 400)
          const target = (await sql`SELECT id FROM employments WHERE id = ${body.reassignTo}::uuid AND company_id = ${companyId} AND status <> 'ended'`).at(0)
          if (!target) return apiJson({ error: 'Choose an active person for their reports.' }, 400)
          newManager = body.reassignTo
        }
        await sql`UPDATE employments SET status = 'ended', end_date = ${endDate}::date, end_reason = ${body.reason}, exit_note = ${body.note?.trim().slice(0, 1000) || null},
          ended_by_membership_id = ${scope.company.membership_id}::uuid, updated_at = now() WHERE id = ${employment.id}`
        const reports = await sql`UPDATE employments SET manager_employment_id = ${newManager}::uuid, updated_at = now()
          WHERE manager_employment_id = ${employment.id} AND status <> 'ended' RETURNING id`
        // Requests still waiting are closed, and approved leave after the last day no longer applies.
        const leave = await sql`UPDATE leave_requests SET status = 'cancelled'::companyfollo_leave_request_status
          WHERE employment_id = ${employment.id} AND (status = 'pending' OR (status = 'approved' AND start_date > ${endDate}::date)) RETURNING id`
        await sql`DELETE FROM person_invitations WHERE person_id = ${params.personId}::uuid AND accepted_at IS NULL`
        if (login) await sql`DELETE FROM organization_memberships WHERE id = ${login.id}`
        const openPayments = await sql`SELECT count(*)::int AS count FROM payments WHERE employment_id = ${employment.id} AND status IN ('draft', 'scheduled')`
        return apiJson({ ok: true, reassigned: reports.length, cancelledLeave: leave.length, accessRemoved: Boolean(login), openPayments: openPayments[0].count })
      }

      if (body?.action === 'rehire') {
        if (employment.status !== 'ended') return apiJson({ error: 'This person is still active.' }, 409)
        await sql`UPDATE employments SET status = 'active', end_date = NULL, end_reason = NULL, exit_note = NULL, ended_by_membership_id = NULL, updated_at = now() WHERE id = ${employment.id}`
        // Their old invitation was used up; clearing it lets HR send a fresh one.
        await sql`DELETE FROM person_invitations WHERE person_id = ${params.personId}::uuid`
        return apiJson({ ok: true })
      }
      return apiJson({ error: 'Unknown action.' }, 400)
    },

    DELETE: async ({ request, params }) => {
      const scope = await requireCompanyAccess(request, 'people', 'write')
      if ('error' in scope) return scope.error
      if (scope.company.role !== 'owner') return apiJson({ error: 'Only the owner can delete records permanently.' }, 403)
      if (!validUuid(params.personId)) return apiJson({ error: 'Person not found.' }, 404)
      const { sql } = scope
      const person = (await sql`
        SELECT p.id, p.avatar_file_key, bool_and(e.status = 'ended') AS all_ended
        FROM people p JOIN employments e ON e.person_id = p.id
        WHERE p.id = ${params.personId}::uuid AND e.company_id = ${scope.company.company_id}
        GROUP BY p.id`).at(0)
      if (!person) return apiJson({ error: 'Person not found.' }, 404)
      if (!person.all_ended) return apiJson({ error: 'Let this person go before deleting their record.' }, 409)
      const files = await sql`SELECT file_key FROM documents WHERE person_id = ${person.id}`
      const keys = [...files.map((row) => String(row.file_key)), ...(person.avatar_file_key ? [String(person.avatar_file_key)] : [])]
      if (keys.length && process.env.UPLOADTHING_TOKEN) await new UTApi().deleteFiles(keys)
      // Cascades to employments, leave, payments, compensation and documents; expenses stay on the company, unlinked.
      await sql`DELETE FROM people WHERE id = ${person.id}`
      return apiJson({ ok: true })
    },
  } },
})
