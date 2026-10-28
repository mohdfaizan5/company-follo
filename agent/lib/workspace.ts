import { getClient } from '../../src/db'

export const AGENT_RESOURCES = [
  'overview',
  'people',
  'calendar',
  'docs',
  'payroll',
  'expenses',
] as const

export type AgentResource = (typeof AGENT_RESOURCES)[number]
export type AgentAction = 'read' | 'write'

type PermissionRule = {
  resource: string
  can_read: boolean
  can_write: boolean
}

type GrantedWorkspace = {
  access: 'granted'
  sql: NonNullable<Awaited<ReturnType<typeof getClient>>>
  companyId: string
  companyName: string
  organizationId: string
  membershipId: string
  role: string
  rules: PermissionRule[]
}

type UnavailableWorkspace = {
  access: 'unavailable'
  message: string
}

export type AgentWorkspace = GrantedWorkspace | UnavailableWorkspace

function defaultPermission(role: string, resource: AgentResource | 'agent') {
  if (role === 'owner' || role === 'hr_admin')
    return { read: true, write: true }
  return { read: resource === 'overview', write: false }
}

function hasPermission(
  workspace: GrantedWorkspace,
  resource: AgentResource | 'agent',
  action: AgentAction,
) {
  if (workspace.role === 'owner') return true
  const rule = workspace.rules.find((item) => item.resource === resource)
  const fallback = defaultPermission(workspace.role, resource)
  return rule
    ? Boolean(action === 'read' ? rule.can_read : rule.can_write)
    : fallback[action]
}

/**
 * Every tool resolves its company and permissions from Eve's authenticated
 * principal. Model-supplied IDs are never used to establish tenant scope.
 */
export async function getAgentWorkspace(
  userId: string,
): Promise<AgentWorkspace> {
  const sql = await getClient()
  if (!sql) throw new Error('CompanyFollo database is unavailable.')

  const company = (
    await sql`
      SELECT c.id AS company_id, c.name AS company_name, c.organization_id,
             m.id AS membership_id, m.role,
             (SELECT COALESCE(json_agg(json_build_object(
               'resource', p.resource,
               'can_read', p.can_read,
               'can_write', p.can_write
             )), '[]'::json)
              FROM company_role_permissions p
              WHERE p.company_id = c.id AND p.role = m.role) AS rules
      FROM organization_memberships m
      JOIN companies c ON c.organization_id = m.organization_id
      WHERE m.app_user_id = ${userId}
      ORDER BY c.created_at ASC
      LIMIT 1
    `
  ).at(0)

  if (!company) {
    return {
      access: 'unavailable',
      message: 'Create or join a company before using Agent.',
    }
  }

  const workspace: GrantedWorkspace = {
    access: 'granted',
    sql,
    companyId: String(company.company_id),
    companyName: String(company.company_name),
    organizationId: String(company.organization_id),
    membershipId: String(company.membership_id),
    role: String(company.role),
    rules: Array.isArray(company.rules)
      ? (company.rules as PermissionRule[])
      : [],
  }

  if (!hasPermission(workspace, 'agent', 'read')) {
    return {
      access: 'unavailable',
      message:
        'You do not have access to CompanyFollo Agent. Ask an owner to enable Agent in Settings.',
    }
  }

  return workspace
}

/** Agent access is an additional gate; the underlying product area still applies. */
export function hasAgentPermission(
  workspace: GrantedWorkspace,
  resource: AgentResource,
  action: AgentAction,
) {
  return (
    hasPermission(workspace, 'agent', action) &&
    hasPermission(workspace, resource, action)
  )
}

export async function getAgentResourceWorkspace(
  userId: string,
  resource: AgentResource,
  action: AgentAction,
): Promise<AgentWorkspace> {
  const workspace = await getAgentWorkspace(userId)
  if (workspace.access === 'unavailable') return workspace
  if (hasAgentPermission(workspace, resource, action)) return workspace

  return {
    access: 'unavailable',
    message: `You do not have permission to ${action} ${resource} through Agent. Ask an owner to review Agent and ${resource} permissions in Settings.`,
  }
}

export function requireAgentUserId(principalId: string | undefined) {
  if (!principalId)
    throw new Error('An authenticated CompanyFollo session is required.')
  return principalId
}
