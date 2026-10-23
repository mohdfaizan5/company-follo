import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Card, CardFrame, CardFrameFooter, CardHeader, CardPanel } from '#/components/ui/card'
import { Field, FieldLabel } from '#/components/ui/field'
import { Form } from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { LoadingState } from '#/components/loading-state'
import { Separator } from '#/components/ui/separator'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const signup = mode === 'signup'
  async function social(provider: 'google' | 'microsoft') {
    setError(null)
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: '/dashboard' })
      if (result?.error) setError(result.error.message ?? `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in is not available yet.`)
    } catch {
      setError('Could not connect. Please try again.')
    }
  }
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
  if (redirecting) return <LoadingState label="Opening your workspace…" />
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <CardFrame className="w-full max-w-sm">
        <Card>
          <CardHeader className="items-center gap-2 text-center">
            <Link to="/" className="font-heading text-2xl font-bold tracking-tight text-foreground no-underline">CompanyFollo</Link>
            <p className="text-sm text-muted-foreground">{signup ? 'Create an owner account. Team members join through an invitation.' : 'Welcome back! Sign in to continue.'}</p>
          </CardHeader>
          <CardPanel>
            <div className="flex flex-col gap-3">
              <Button type="button" className="w-full" onClick={() => social('google')}><GoogleIcon />{signup ? 'Sign up' : 'Sign in'} with Google</Button>
              <Button type="button" variant="secondary" className="w-full" onClick={() => social('microsoft')}><MicrosoftIcon />{signup ? 'Sign up' : 'Sign in'} with Microsoft</Button>
            </div>
            <div className="my-6 flex items-center gap-4 text-sm text-muted-foreground" role="separator"><Separator className="flex-1" /><span>or</span><Separator className="flex-1" /></div>
            <Form onSubmit={submit} className="flex w-full flex-col gap-4">
              {signup ? <Field><FieldLabel>Your name</FieldLabel><Input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></Field> : null}
              <Field><FieldLabel>Email</FieldLabel><Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>
              <Field>
                <div className="flex w-full items-center justify-between">
                  <FieldLabel>Password</FieldLabel>
                  {signup ? null : <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setError('Password reset is not available yet. Contact your workspace owner.')}>Forgot?</button>}
                </div>
                <div className="relative w-full">
                  <Input required type={showPassword ? 'text' : 'password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} className="[&_input]:pr-10" />
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                </div>
              </Field>
              {error ? <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">{error}</p> : null}
              <Button type="submit" className="w-full" loading={pending}>Continue</Button>
            </Form>
          </CardPanel>
        </Card>
        <CardFrameFooter className="text-center text-sm">
          <Link to={signup ? '/login' : '/signup'} className="text-foreground no-underline hover:underline">{signup ? 'Log in' : 'Create account'}</Link>
        </CardFrameFooter>
      </CardFrame>
    </main>
  )
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.800 3.500 14.600 2.500 12 2.500 6.800 2.500 2.500 6.800 2.500 12s4.300 9.500 9.500 9.500c5.500 0 9.100-3.800 9.100-9.300 0-.6-.1-1.100-.2-1.600H12z"/></svg>
}

function MicrosoftIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="#F25022" d="M2 2h9.500v9.500H2z"/><path fill="#7FBA00" d="M12.500 2H22v9.500h-9.500z"/><path fill="#00A4EF" d="M2 12.500h9.500V22H2z"/><path fill="#FFB900" d="M12.500 12.500H22V22h-9.500z"/></svg>
}
