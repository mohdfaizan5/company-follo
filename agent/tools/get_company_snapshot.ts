import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { getAgentResourceWorkspace, requireAgentUserId } from '../lib/workspace'

/**
 * The filename becomes the tool name. This tool derives both the company and
 * permissions from Eve's authenticated principal; the model never supplies IDs.
 */
export default defineTool({
  description: 'Get a concise, read-only summary of the current HR workspace.',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const userId = requireAgentUserId(ctx.session.auth.current?.principalId)
    const workspace = await getAgentResourceWorkspace(
      userId,
      'overview',
      'read',
    )
    if (workspace.access === 'unavailable') return workspace

    const [people, leave, payments] = await Promise.all([
      workspace.sql`SELECT COUNT(*)::int AS count FROM employments WHERE company_id = ${workspace.companyId}::uuid AND status <> 'ended'`,
      workspace.sql`SELECT COUNT(*)::int AS count FROM leave_requests lr JOIN employments e ON e.id = lr.employment_id WHERE e.company_id = ${workspace.companyId}::uuid AND lr.status = 'pending'`,
      workspace.sql`SELECT COUNT(*)::int AS count FROM payments p JOIN employments e ON e.id = p.employment_id WHERE e.company_id = ${workspace.companyId}::uuid AND p.created_at >= date_trunc('month', now())`,
    ])

    return {
      view: 'company_snapshot',
      access: 'granted',
      companyName: workspace.companyName,
      role: workspace.role,
      activePeople: Number(people.at(0)?.count ?? 0),
      pendingLeaveRequests: Number(leave.at(0)?.count ?? 0),
      paymentsRecordedThisMonth: Number(payments.at(0)?.count ?? 0),
    }
  },
})
