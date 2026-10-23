import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { NotFoundPage } from '#/components/not-found-page'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#/components/ui/breadcrumb'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Form } from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { SettingsRow, SettingsSection } from '#/components/settings-form'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '#/components/ui/select'
import { peopleQueryOptions, personName } from '#/lib/people-client'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'

export const Route = createFileRoute('/dashboard/people/new')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions),
      context.queryClient.ensureQueryData(peopleQueryOptions),
    ])
  },
  component: AddPerson,
})

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function AddPerson() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const workspace = useWorkspace(true)
  const people = useQuery(peopleQueryOptions)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [managerEmploymentId, setManagerEmploymentId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, role, email, personalEmail, managerEmploymentId, startDate }) })
      const payload = await response.json() as { person?: { id: string }; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not add this person.')
      return payload.person
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['overview'] })
      void navigate({ to: '/dashboard/people' })
    },
  })
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate()
  }
  const managerItems = [{ label: 'No manager', value: '' }, ...(people.data ?? []).map((person) => ({ label: personName(person), value: person.employment_id }))]

  return (
    <DashboardPage title="Add a person" showHeading={false}>
      {workspace.data && !workspace.data.permissions.people.write ? <NotFoundPage /> : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
          <div className="flex flex-col gap-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink render={<Link to="/dashboard/people" />}>People</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Add a person</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight">Add a person</h1>
              <p className="text-muted-foreground">Add their contact details here, then upload a photo and documents on their profile.</p>
            </div>
          </div>
          <Form onSubmit={submit} className="flex w-full flex-col gap-10">
            <Card className="divide-y">
              <SettingsRow label="Photo & name">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed bg-muted/50 text-muted-foreground"><UserRound className="size-4" /></span>
                  <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Priya Sharma" autoComplete="off" autoFocus />
                </div>
              </SettingsRow>
              <SettingsRow label="Role" description="Shown on their profile and in the directory">
                <Input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Product designer" />
              </SettingsRow>
              {people.data?.length ? (
                <SettingsRow label="Reports to" description="Optional, places them in the reporting tree">
                  <Select items={managerItems} value={managerItems.find((item) => item.value === managerEmploymentId)} onValueChange={(item) => setManagerEmploymentId(item?.value ?? '')} itemToStringValue={(item) => item.label}>
                    <SelectTrigger aria-label="Reports to"><SelectValue /></SelectTrigger>
                    <SelectPopup>{managerItems.map((item) => <SelectItem key={item.value} value={item}>{item.label}</SelectItem>)}</SelectPopup>
                  </Select>
                </SettingsRow>
              ) : null}
            </Card>

            <SettingsSection title="Contact" description="The invitation goes to their personal email, so they can sign in before their work account is set up.">
              <SettingsRow label="Personal email" description="Receives the invitation">
                <Input type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} placeholder="name@example.com" autoComplete="off" />
              </SettingsRow>
              <SettingsRow label="Work email" description="Optional, add it later if it doesn't exist yet">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="off" />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Employment" description="Used for tenure, anniversaries and onboarding timelines.">
              <SettingsRow label="Joined on" description="Defaults to today">
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Profile" description="Available once they're added.">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 text-sm text-muted-foreground sm:px-6">
                <span>Documents</span>
                <span>Upload on their profile</span>
              </div>
            </SettingsSection>

            {create.isError ? <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">{create.error.message}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" render={<Link to="/dashboard/people" />}>Cancel</Button>
              <Button type="submit" loading={create.isPending}><Plus data-icon="inline-start" />Add person</Button>
            </div>
          </Form>
        </div>
      )}
    </DashboardPage>
  )
}
