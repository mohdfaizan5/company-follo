import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Check, Users } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { EmployeePhotoActions } from '#/components/employee-uploads'
import { NotFoundPage } from '#/components/not-found-page'
import { SettingsRow, SettingsSection } from '#/components/settings-form'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#/components/ui/breadcrumb'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Field } from '#/components/ui/field'
import { Form } from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { getPersonProfile, peopleQueryOptions, personName } from '#/lib/people-client'
import { workspaceQueryOptions } from '#/lib/workspace-client'
import type { Person, PersonProfile } from '#/lib/people-client'

export const Route = createFileRoute('/dashboard/people/$personId_/edit')({
  loader: async ({ context, params }) => {
    if (typeof window === 'undefined') return
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions),
      context.queryClient.ensureQueryData(peopleQueryOptions),
      context.queryClient.ensureQueryData({ queryKey: ['person', params.personId], queryFn: () => getPersonProfile(params.personId), staleTime: 60_000 }),
    ])
  },
  component: EditPersonPage,
})

function EditPersonPage() {
  const { personId } = Route.useParams()
  return <DashboardPage title="Edit details" showHeading={false}><EditContent personId={personId} /></DashboardPage>
}

function EditContent({ personId }: { personId: string }) {
  const profile = useQuery({ queryKey: ['person', personId], queryFn: () => getPersonProfile(personId), staleTime: 60_000 })
  const people = useQuery(peopleQueryOptions)
  if (profile.isPending) return <p className="text-sm text-muted-foreground">Loading profile…</p>
  if (profile.isError) return <p className="text-sm text-destructive">{profile.error.message}</p>
  if (!profile.data.canWritePeople) return <NotFoundPage />
  return <EditForm data={profile.data} people={people.data ?? []} />
}

function EditForm({ data, people }: { data: PersonProfile; people: Person[] }) {
  const { person } = data
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const name = personName(person)
  // What the form started with; a field counts as edited when it differs from this.
  const initial = {
    name,
    title: person.title,
    managerEmploymentId: person.manager_employment_id ?? '',
    department: person.department ?? '',
    level: person.level ?? '',
    startDate: person.start_date.slice(0, 10),
    email: person.work_email ?? '',
    personalEmail: person.personal_email ?? '',
    phone: person.phone_number ?? '',
    address: person.address ?? '',
    notes: person.notes ?? '',
  }
  const [values, setValues] = useState(initial)
  const set = (key: keyof typeof initial) => (value: string) => setValues((current) => ({ ...current, [key]: value }))
  const edited = (key: keyof typeof initial) => values[key].trim() !== initial[key].trim()
  const changes = (Object.keys(initial) as (keyof typeof initial)[]).filter(edited).length

  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/people/${person.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save details.')
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['person', person.id] }),
        queryClient.invalidateQueries({ queryKey: ['people'] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
      ])
      void navigate({ to: '/dashboard/people/$personId', params: { personId: person.id } })
    },
  })
  const managerItems = [{ label: 'No manager', value: '' }, ...people.filter((candidate) => candidate.id !== person.id).map((candidate) => ({ label: personName(candidate), value: candidate.employment_id }))]
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      {/* Breadcrumb, title and intro */}
      <div className="flex flex-col gap-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink className="inline-flex items-center gap-1.5" render={<Link to="/dashboard/people" />}><Users className="size-4" aria-hidden="true" />People</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink className="max-w-40 truncate sm:max-w-64" render={<Link to="/dashboard/people/$personId" params={{ personId: person.id }} />}>{name}</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Edit</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Edit details</h1>
          <p className="text-muted-foreground">Update {person.first_name}&apos;s work and contact details. Changes show on their profile right away.</p>
        </div>
      </div>

      <Form onSubmit={(event) => { event.preventDefault(); save.mutate() }} className="flex w-full flex-col gap-10">
        {/* Photo, name and role */}
        <Card className="divide-y">
          <SettingsRow label="Photo" description="Square image, at least 256px">
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <Avatar className="size-14">{person.avatar_url && <AvatarImage src={person.avatar_url} alt={name} />}<AvatarFallback className="bg-primary/16 text-lg font-semibold text-primary">{initials}</AvatarFallback></Avatar>
              <EmployeePhotoActions personId={person.id} enabled={data.uploadsEnabled} hasPhoto={Boolean(person.avatar_url)} />
            </div>
          </SettingsRow>
          <SettingsRow label="Name" edited={edited('name')}><Input required value={values.name} onChange={(event) => set('name')(event.target.value)} /></SettingsRow>
          <SettingsRow label="Role" edited={edited('title')}><Input required value={values.title} onChange={(event) => set('title')(event.target.value)} /></SettingsRow>
        </Card>

        {/* Organization: manager, department, level, start date */}
        <SettingsSection title="Organization" description="Where they sit in the team and who they report to.">
          <SettingsRow label="Reports to" edited={edited('managerEmploymentId')}>
            <Select items={managerItems} value={managerItems.find((item) => item.value === values.managerEmploymentId)} onValueChange={(item) => set('managerEmploymentId')(item?.value ?? '')} itemToStringValue={(item) => item.label}>
              <SelectTrigger aria-label="Reports to"><SelectValue /></SelectTrigger>
              <SelectPopup>{managerItems.map((item) => <SelectItem key={item.value} value={item}>{item.label}</SelectItem>)}</SelectPopup>
            </Select>
          </SettingsRow>
          <SettingsRow label="Department" edited={edited('department')}><Input value={values.department} onChange={(event) => set('department')(event.target.value)} placeholder="e.g. Design" /></SettingsRow>
          <SettingsRow label="Level" edited={edited('level')}><Input value={values.level} onChange={(event) => set('level')(event.target.value)} placeholder="e.g. Senior" /></SettingsRow>
          <SettingsRow label="Joined on" edited={edited('startDate')}><Input required type="date" value={values.startDate} onChange={(event) => set('startDate')(event.target.value)} /></SettingsRow>
        </SettingsSection>

        {/* Contact: work and personal email, phone, address */}
        <SettingsSection title="Contact" description="How to reach them at work and at home.">
          <SettingsRow label="Work email" edited={edited('email')}><Input type="email" value={values.email} onChange={(event) => set('email')(event.target.value)} placeholder="name@company.com" /></SettingsRow>
          <SettingsRow label="Personal email" description="Receives the invitation" edited={edited('personalEmail')}><Input type="email" value={values.personalEmail} onChange={(event) => set('personalEmail')(event.target.value)} placeholder="name@example.com" /></SettingsRow>
          <SettingsRow label="Phone" edited={edited('phone')}><Input value={values.phone} onChange={(event) => set('phone')(event.target.value)} placeholder="+91 00000 00000" /></SettingsRow>
          <SettingsRow label="Address" edited={edited('address')}><Textarea rows={3} value={values.address} onChange={(event) => set('address')(event.target.value)} placeholder="Street, city, postcode" /></SettingsRow>
        </SettingsSection>

        {/* Notes: coss Textarea with the p-textarea-9 look (muted fill, no border or shadow) */}
        <SettingsSection title="Notes" description="Anything worth remembering about this person.">
          <Field className="p-3">
            <Textarea aria-label={`Notes about ${name}`} className="border-transparent bg-muted shadow-none before:hidden [&_textarea]:min-h-32" rows={5} value={values.notes} onChange={(event) => set('notes')(event.target.value)} placeholder="Add a note…" />
          </Field>
        </SettingsSection>

        {save.isError ? <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">{save.error.message}</p> : null}

        {/* Sticky action bar: unsaved-change count, Cancel and Save */}
        <Card className="sticky bottom-4 z-10 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <span aria-hidden="true" className={changes ? 'size-2 rounded-full bg-warning' : 'size-2 rounded-full bg-muted-foreground/40'} />
            {changes ? `${changes} unsaved change${changes === 1 ? '' : 's'}` : 'No changes yet'}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" render={<Link to="/dashboard/people/$personId" params={{ personId: person.id }} />}>Cancel</Button>
            <Button type="submit" disabled={!changes} loading={save.isPending}><Check data-icon="inline-start" />Save details</Button>
          </div>
        </Card>
      </Form>
    </div>
  )
}
