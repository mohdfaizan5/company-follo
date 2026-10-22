import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'

type Invitation = { email: string; role: 'hr_admin' | 'employee'; company_name: string; first_name: string; last_name: string | null }

export const Route = createFileRoute('/invite/$token')({ component: InvitePage })

function InvitePage() {
  const { token } = Route.useParams()
  const { data: session } = authClient.useSession()
  const [password, setPassword] = useState('')
  const [redirecting, setRedirecting] = useState(false)
  const invitation = useQuery({ queryKey: ['invitation', token], queryFn: async () => {
    const response = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
    const payload = await response.json() as { invitation?: Invitation; error?: string }
    if (!response.ok || !payload.invitation) throw new Error(payload.error ?? 'Invitation unavailable.')
    return payload.invitation
  }, retry: false })
  const accept = useMutation({ mutationFn: async () => {
    const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
    const payload = await response.json() as { ok?: boolean; newAccount?: boolean; email?: string; error?: string }
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Could not accept invitation.')
    if (payload.newAccount && payload.email) {
      const login = await authClient.signIn.email({ email: payload.email, password })
      if (login.error) throw new Error('Account created. Log in with your new password to continue.')
    }
    return payload
  }, onSuccess: () => { setRedirecting(true); window.location.replace('/dashboard') } })
  const invite = invitation.data
  const signedInAsInvitee = session?.user.email.toLowerCase() === invite?.email.toLowerCase()
  return <main className="grid min-h-svh place-items-center bg-background px-5 py-10"><div className="w-full max-w-md"><Link to="/" className="mb-8 block text-center text-sm font-semibold no-underline">CompanyFollo</Link><Card><CardHeader><CardTitle>{redirecting ? 'Opening your workspace…' : 'Join your team'}</CardTitle><CardDescription>{invite ? `${invite.first_name} ${invite.last_name ?? ''}, you were invited to ${invite.company_name} as ${invite.role === 'hr_admin' ? 'HR admin' : 'a team member'}.` : 'Checking your invitation…'}</CardDescription></CardHeader><CardContent>{invitation.isPending && <p className="text-sm text-muted-foreground">Loading invitation…</p>}{invitation.isError && <p role="alert" className="text-sm text-destructive">{invitation.error.message}</p>}{invite && !redirecting && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); accept.mutate() }}><p className="text-sm text-muted-foreground">Account email: <span className="font-medium text-foreground">{invite.email}</span></p>{session?.user && !signedInAsInvitee ? <p className="text-sm text-destructive">You are signed in as {session.user.email}. Sign out, then reopen this link.</p> : null}{!session?.user && <label className="block text-sm font-medium">Set your password<Input className="mt-1.5" required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}{accept.isError && <p role="alert" className="text-sm text-destructive">{accept.error.message}</p>}<Button type="submit" className="w-full" disabled={Boolean(session?.user && !signedInAsInvitee)} loading={accept.isPending}>Accept invitation</Button></form>}</CardContent></Card></div></main>
}
