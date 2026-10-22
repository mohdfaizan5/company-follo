import { createHash, randomBytes } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { apiJson, requireCompanyAccess, validUuid } from '#/lib/server-workspace'

export const Route = createFileRoute('/api/invitations')({
  server: { handlers: {
    POST: async ({ request }) => {
      const scope = await requireCompanyAccess(request, 'people', 'write')
      if ('error' in scope) return scope.error
      if (scope.company.role !== 'owner' && scope.company.role !== 'hr_admin') return apiJson({ error: 'Only the owner or HR can invite people.' }, 403)
      const body = await request.json().catch(() => null) as { personId?: string; role?: string } | null
      if (!body?.personId || !validUuid(body.personId) || !['employee', 'hr_admin'].includes(body.role ?? '')) return apiJson({ error: 'Choose a person and an access role.' }, 400)
      if (body.role === 'hr_admin' && scope.company.role !== 'owner') return apiJson({ error: 'Only the owner can invite HR admins.' }, 403)
      const person = (await scope.sql`SELECT p.id, p.personal_email FROM people p JOIN employments e ON e.person_id = p.id
        WHERE p.id = ${body.personId}::uuid AND e.company_id = ${scope.company.company_id} AND e.status <> 'ended' LIMIT 1`).at(0)
      if (!person) return apiJson({ error: 'Person not found.' }, 404)
      if (!person.personal_email) return apiJson({ error: 'Add a personal email before inviting this person.' }, 400)
      const token = randomBytes(32).toString('base64url')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await scope.sql`INSERT INTO person_invitations (person_id, company_id, organization_id, email, role, token_hash, expires_at, created_by_membership_id)
        VALUES (${person.id}, ${scope.company.company_id}, ${scope.company.organization_id}, ${person.personal_email}, ${body.role}::companyfollo_member_role,
          ${tokenHash}, now() + interval '7 days', ${scope.company.membership_id})
        ON CONFLICT (person_id) DO UPDATE SET email = excluded.email, role = excluded.role, token_hash = excluded.token_hash,
          expires_at = excluded.expires_at, accepted_at = NULL, accepted_by_user_id = NULL, created_by_membership_id = excluded.created_by_membership_id, created_at = now()`
      const url = new URL(`/invite/${token}`, request.url).toString()
      return apiJson({ url, email: person.personal_email, expiresInDays: 7 }, 201)
    },
  } },
})
