import { createHash } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { getClient } from '#/db'
import { apiJson } from '#/lib/server-workspace'

function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

export const Route = createFileRoute('/api/invitations/accept')({
  server: { handlers: {
    GET: async ({ request }) => {
      const token = new URL(request.url).searchParams.get('token') ?? ''
      if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return apiJson({ error: 'Invalid invitation.' }, 404)
      const sql = await getClient()
      if (!sql) return apiJson({ error: 'Database unavailable.' }, 503)
      const invite = (await sql`SELECT i.email, i.role::text, c.name AS company_name, p.first_name, p.last_name
        FROM person_invitations i JOIN companies c ON c.id = i.company_id JOIN people p ON p.id = i.person_id
        WHERE i.token_hash = ${hashToken(token)} AND i.accepted_at IS NULL AND i.expires_at > now()`).at(0)
      if (!invite) return apiJson({ error: 'This invitation has expired or was already used.' }, 404)
      return apiJson({ invitation: invite }, 200)
    },
    POST: async ({ request }) => {
      const body = await request.json().catch(() => null) as { token?: string; password?: string } | null
      const token = body?.token ?? ''
      if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return apiJson({ error: 'Invalid invitation.' }, 400)
      const sql = await getClient()
      if (!sql) return apiJson({ error: 'Database unavailable.' }, 503)
      const tokenHash = hashToken(token)
      const invite = (await sql`SELECT i.id, i.email, i.role::text, i.organization_id, p.first_name, p.last_name
        FROM person_invitations i JOIN people p ON p.id = i.person_id
        WHERE i.token_hash = ${tokenHash} AND i.accepted_at IS NULL AND i.expires_at > now()`).at(0)
      if (!invite) return apiJson({ error: 'This invitation has expired or was already used.' }, 404)
      const session = await auth.api.getSession({ headers: request.headers })
      let userId: string
      let newAccount = false
      if (session?.user) {
        if (session.user.email.toLowerCase() !== String(invite.email).toLowerCase()) return apiJson({ error: `Sign in as ${invite.email} to accept this invitation.` }, 403)
        userId = session.user.id
      } else {
        if (!body?.password || body.password.length < 8 || body.password.length > 128) return apiJson({ error: 'Choose a password of 8–128 characters.' }, 400)
        try {
          const created = await auth.api.signUpEmail({ body: { email: String(invite.email), password: body.password, name: `${invite.first_name} ${invite.last_name ?? ''}`.trim() } })
          userId = created.user.id
          newAccount = true
        } catch {
          return apiJson({ error: 'An account already uses this email. Sign in, then reopen this invitation.' }, 409)
        }
      }
      const claimed = (await sql`WITH claimed AS (
          UPDATE person_invitations SET accepted_at = now(), accepted_by_user_id = ${userId}
          WHERE id = ${invite.id} AND token_hash = ${tokenHash} AND accepted_at IS NULL AND expires_at > now()
          RETURNING organization_id, role
        ), membership AS (
          INSERT INTO organization_memberships (organization_id, app_user_id, role)
          SELECT organization_id, ${userId}, role FROM claimed
          ON CONFLICT (organization_id, app_user_id) DO NOTHING
          RETURNING organization_id
        ) SELECT organization_id FROM claimed`).at(0)
      if (!claimed) return apiJson({ error: 'This invitation was already used.' }, 409)
      return apiJson({ ok: true, newAccount, email: invite.email })
    },
  } },
})
