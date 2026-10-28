import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { appToast } from '#/lib/toast'

export function WorkspaceSetup() {
  const queryClient = useQueryClient()
  const [organizationName, setOrganizationName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName, companyName, currency }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not create your workspace.')
      await queryClient.invalidateQueries({ queryKey: ['workspace'] })
      appToast.success('Workspace created', { description: 'Your company is ready to set up.' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create your workspace.')
      appToast.error('Workspace not created', cause, 'Could not create your workspace.')
    } finally {
      setSaving(false)
    }
  }

  const currencies = [{ label: 'INR — Indian rupee', value: 'INR' }, { label: 'USD — US dollar', value: 'USD' }]
  return <main className="grid min-h-svh place-items-center p-5"><Card className="w-full max-w-md"><CardHeader><span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Building2 className="size-4" /></span><CardTitle className="mt-4">Set up your company</CardTitle><CardDescription>Start with the name you use day to day. You can add the finer details later.</CardDescription></CardHeader><CardContent><form className="flex flex-col gap-4" onSubmit={submit}><label className="flex flex-col gap-1.5 text-sm font-medium">Organization<Input required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="e.g. Acme Group" autoFocus /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Company<Input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Acme Labs" /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Default currency<Select items={currencies} value={currencies.find((item) => item.value === currency)} onValueChange={(item) => { if (item) setCurrency(item.value as 'INR' | 'USD') }} itemToStringValue={(item) => item.label}><SelectTrigger aria-label="Default currency"><SelectValue /></SelectTrigger><SelectPopup>{currencies.map((item) => <SelectItem key={item.value} value={item}>{item.label}</SelectItem>)}</SelectPopup></Select></label>{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button type="submit" loading={saving} className="mt-1">Create workspace</Button></form></CardContent></Card></main>
}
