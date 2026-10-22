import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getClient } from '#/db'
import { ACCESS_RESOURCES, defaultPermission } from '#/lib/server-workspace'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function currentUser(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

export const Route = createFileRoute('/api/workspace')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await currentUser(request)
        if (!session?.user) return json({ error: 'Unauthorized' }, 401)

        const sql = await getClient()
        if (!sql) return json({ error: 'Database unavailable' }, 503)

        const workspace = (await sql`
          SELECT o.id AS organization_id, o.name AS organization_name,
                 c.id AS company_id, c.name AS company_name, c.default_currency,
                 m.role
          FROM organization_memberships m
          JOIN organizations o ON o.id = m.organization_id
          JOIN companies c ON c.organization_id = o.id
          WHERE m.app_user_id = ${session.user.id}
          ORDER BY c.created_at ASC
          LIMIT 1
        `).at(0)

        if (!workspace) return json({ workspace: null })
        const rows = await sql`SELECT resource, can_read, can_write FROM company_role_permissions WHERE company_id = ${workspace.company_id} AND role = ${workspace.role}::companyfollo_member_role`
        const permissions = Object.fromEntries(ACCESS_RESOURCES.map((resource) => {
          const rule = rows.find((row) => row.resource === resource)
          const fallback = defaultPermission(String(workspace.role), resource)
          return [resource, { read: rule ? Boolean(rule.can_read) : fallback.read, write: rule ? Boolean(rule.can_write) : fallback.write }]
        }))
        return json({ workspace: { ...workspace, permissions } })
      },
      POST: async ({ request }) => {
        const session = await currentUser(request)
        if (!session?.user) return json({ error: 'Unauthorized' }, 401)

        const body = await request.json().catch(() => null) as { organizationName?: string; companyName?: string; currency?: string } | null
        const organizationName = body?.organizationName?.trim()
        const companyName = body?.companyName?.trim()
        const currency = body?.currency === 'USD' ? 'USD' : 'INR'
        if (!organizationName || !companyName) return json({ error: 'Organization and company names are required.' }, 400)

        const sql = await getClient()
        if (!sql) return json({ error: 'Database unavailable' }, 503)

        const existing = await sql`
          SELECT c.id
          FROM organization_memberships m
          JOIN companies c ON c.organization_id = m.organization_id
          WHERE m.app_user_id = ${session.user.id}
          LIMIT 1
        `
        if (existing.length) return json({ error: 'A workspace already exists for this account.' }, 409)

        const [organization] = await sql`
          INSERT INTO organizations (name) VALUES (${organizationName}) RETURNING id, name
        `
        await sql`
          INSERT INTO organization_memberships (organization_id, app_user_id, role)
          VALUES (${organization.id}, ${session.user.id}, 'owner')
        `
        const [company] = await sql`
          INSERT INTO companies (organization_id, name, default_currency)
          VALUES (${organization.id}, ${companyName}, ${currency}::companyfollo_currency)
          RETURNING id, name, default_currency
        `

        return json({ workspace: {
          organization_id: organization.id,
          organization_name: organization.name,
          company_id: company.id,
          company_name: company.name,
          default_currency: company.default_currency,
          role: 'owner',
          permissions: Object.fromEntries(ACCESS_RESOURCES.map((resource) => [resource, { read: true, write: true }])),
        } }, 201)
      },
    },
  },
})
