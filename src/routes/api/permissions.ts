import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getClient } from '#/db'
import { ACCESS_RESOURCES, apiJson, defaultPermission } from '#/lib/server-workspace'
import type { AccessResource } from '#/lib/server-workspace'

const editableRoles = ['hr_admin', 'employee'] as const

export const Route = createFileRoute('/api/permissions')({
  server: { handlers: {
    GET: async ({ request }) => {
      const scope = await ownerScope(request)
      if ('error' in scope) return scope.error
      const rows = await scope.sql`SELECT role::text, resource, can_read, can_write FROM company_role_permissions WHERE company_id = ${scope.companyId}`
      return apiJson({ rules: editableRoles.flatMap((role) => ACCESS_RESOURCES.map((resource) => {
        const saved = rows.find((row) => row.role === role && row.resource === resource)
        const fallback = defaultPermission(role, resource)
        return { role, resource, read: saved ? Boolean(saved.can_read) : fallback.read, write: saved ? Boolean(saved.can_write) : fallback.write }
      })) })
    },
    POST: async ({ request }) => {
      const scope = await ownerScope(request)
      if ('error' in scope) return scope.error
      const body = await request.json().catch(() => null) as { role?: string; resource?: string; read?: boolean; write?: boolean } | null
      if (!body || !editableRoles.includes(body.role as typeof editableRoles[number]) || !ACCESS_RESOURCES.includes(body.resource as AccessResource) || typeof body.read !== 'boolean' || typeof body.write !== 'boolean' || (body.write && !body.read)) return apiJson({ error: 'Invalid permission rule.' }, 400)
      await scope.sql`INSERT INTO company_role_permissions (company_id, role, resource, can_read, can_write)
        VALUES (${scope.companyId}, ${body.role}::companyfollo_member_role, ${body.resource}, ${body.read}, ${body.write})
        ON CONFLICT (company_id, role, resource) DO UPDATE SET can_read = excluded.can_read, can_write = excluded.can_write, updated_at = now()`
      return apiJson({ ok: true })
    },
  } },
})

async function ownerScope(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return { error: apiJson({ error: 'Sign in to continue.' }, 401) }
  const sql = await getClient()
  if (!sql) return { error: apiJson({ error: 'Database unavailable.' }, 503) }
  const membership = (await sql`SELECT c.id AS company_id, m.role FROM organization_memberships m
    JOIN companies c ON c.organization_id = m.organization_id WHERE m.app_user_id = ${session.user.id}
    ORDER BY c.created_at ASC LIMIT 1`).at(0)
  if (!membership || membership.role !== 'owner') return { error: apiJson({ error: 'Only the owner can change permissions.' }, 403) }
  return { sql, companyId: membership.company_id }
}
