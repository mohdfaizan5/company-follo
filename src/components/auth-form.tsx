import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const signup = mode === 'signup'
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = signup
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message ?? 'Something went wrong. Try again.')
        return
      }
      setRedirecting(true)
      window.location.replace('/dashboard')
    } catch {
      setError('Could not connect. Please try again.')
    } finally {
      if (!redirecting) setPending(false)
    }
  }
  if (redirecting) return <main className="grid min-h-svh place-items-center text-sm text-muted-foreground" role="status">Opening your workspace…</main>
  return <main className="grid min-h-screen place-items-center bg-background px-5 py-10"><div className="w-full max-w-sm"><Link to="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold text-foreground no-underline"><span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] text-primary-foreground">C</span>CompanyFollo</Link><Card><CardHeader><CardTitle>{signup ? 'Create your workspace' : 'Welcome back'}</CardTitle><CardDescription>{signup ? 'Create an owner account. Team members join through an invitation.' : 'Log in with the email on your account.'}</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="flex flex-col gap-4">{signup ? <label className="flex flex-col gap-1.5 text-sm font-medium">Your name<Input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label> : null}<label className="flex flex-col gap-1.5 text-sm font-medium">Email<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Password<Input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} /></label>{error ? <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">{error}</p> : null}<Button type="submit" loading={pending}>{signup ? 'Create account' : 'Log in'}<ArrowRight data-icon="inline-end" /></Button></form><p className="mt-5 text-center text-sm text-muted-foreground">{signup ? 'Already have an account?' : 'Creating a new company?'} <Link to={signup ? '/login' : '/signup'} className="text-foreground underline underline-offset-4">{signup ? 'Log in' : 'Sign up as owner'}</Link></p></CardContent></Card></div></main>
}
