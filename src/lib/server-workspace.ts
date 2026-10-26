import { auth } from '#/lib/auth'
import { getClient } from '#/db'

export const ACCESS_RESOURCES = ['overview', 'people', 'calendar', 'docs', 'payroll', 'expenses'] as const
export type AccessResource = typeof ACCESS_RESOURCES[number]
export type AccessAction = 'read' | 'write'

export function defaultPermission(role: string, resource: AccessResource) {
  if (role === 'owner') return { read: true, write: true }
  if (role === 'hr_admin') return { read: true, write: true }
  return { read: resource === 'overview', write: false }
}

export function apiJson(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function requireHrWorkspace(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return { error: apiJson({ error: 'Sign in to continue.' }, 401) }
  const sql = await getClient()
  if (!sql) return { error: apiJson({ error: 'Database unavailable.' }, 503) }
  const company = (await sql`
    SELECT c.id AS company_id, c.organization_id, c.name AS company_name,
           c.public_slug, m.id AS membership_id, m.role,
           (SELECT COALESCE(json_agg(json_build_object('resource', p.resource, 'can_read', p.can_read, 'can_write', p.can_write)), '[]'::json)
             FROM company_role_permissions p WHERE p.company_id = c.id AND p.role = m.role) AS rules
    FROM organization_memberships m
    JOIN companies c ON c.organization_id = m.organization_id
    WHERE m.app_user_id = ${session.user.id}
    ORDER BY c.created_at ASC LIMIT 1
  `).at(0)
  if (!company) return { error: apiJson({ error: 'Create a company first.' }, 409) }
  if (company.role === 'employee') return { error: apiJson({ error: 'HR access is required.' }, 403) }
  return { sql, company, userId: session.user.id }
}

export async function hasCompanyPermission(scope: Awaited<ReturnType<typeof requireHrWorkspace>> & { error?: never }, resource: AccessResource, action: AccessAction) {
  if (scope.company.role === 'owner') return true
  const rules = scope.company.rules as { resource: string; can_read: boolean; can_write: boolean }[]
  const rule = rules.find((row) => row.resource === resource)
  return rule ? Boolean(action === 'read' ? rule.can_read : rule.can_write) : defaultPermission(String(scope.company.role), resource)[action]
}

export async function requireCompanyAccess(request: Request, resource: AccessResource, action: AccessAction) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return { error: apiJson({ error: 'Sign in to continue.' }, 401) }
  const sql = await getClient()
  if (!sql) return { error: apiJson({ error: 'Database unavailable.' }, 503) }
  const company = (await sql`SELECT c.id AS company_id, c.organization_id, c.name AS company_name, c.public_slug,
    m.id AS membership_id, m.role,
    (SELECT COALESCE(json_agg(json_build_object('resource', p.resource, 'can_read', p.can_read, 'can_write', p.can_write)), '[]'::json)
             FROM company_role_permissions p WHERE p.company_id = c.id AND p.role = m.role) AS rules
    FROM organization_memberships m JOIN companies c ON c.organization_id = m.organization_id
    WHERE m.app_user_id = ${session.user.id} ORDER BY c.created_at ASC LIMIT 1`).at(0)
  if (!company) return { error: apiJson({ error: 'Create a company first.' }, 409) }
  const scope = { sql, company, userId: session.user.id }
  if (!await hasCompanyPermission(scope, resource, action)) return { error: apiJson({ error: 'You do not have access to this area.' }, 403) }
  return scope
}

export function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'company'
}

/** Any member of the company, whatever their role or permissions. Used for a person's own data. */
export async function requireMember(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return { error: apiJson({ error: 'Sign in to continue.' }, 401) }
  const sql = await getClient()
  if (!sql) return { error: apiJson({ error: 'Database unavailable.' }, 503) }
  const company = (await sql`SELECT c.id AS company_id, c.organization_id, c.name AS company_name, c.public_slug, c.logo_url,
    c.default_currency, c.working_days, m.id AS membership_id, m.role
    FROM organization_memberships m JOIN companies c ON c.organization_id = m.organization_id
    WHERE m.app_user_id = ${session.user.id} ORDER BY c.created_at ASC LIMIT 1`).at(0)
  if (!company) return { error: apiJson({ error: 'Create a company first.' }, 409) }
  return { sql, company, userId: session.user.id, email: session.user.email }
}
