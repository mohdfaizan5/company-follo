import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Network, Plus, Users } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Tabs, TabsList, TabsPanel, TabsTab } from '#/components/ui/tabs'
import { Frame, FramePanel } from '#/components/ui/frame'
import { peopleQueryOptions, personName } from '#/lib/people-client'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'
import type { Person } from '#/lib/people-client'

export const Route = createFileRoute('/dashboard/people/')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions),
      context.queryClient.ensureQueryData(peopleQueryOptions),
    ])
  },
  component: People,
})

const ReportingTree = lazy(() => import('#/components/reporting-tree').then((module) => ({ default: module.ReportingTree })))

function People() {
  const people = useQuery(peopleQueryOptions)
  const workspace = useWorkspace(true)
  return <DashboardPage title="People" description="Your team's reporting structure." actions={workspace.data?.permissions.people.write ? <CreateEmployee people={people.data ?? []} /> : undefined}>
    {people.isPending ? <p className="text-sm text-muted-foreground">Loading people…</p> : null}
    {people.isError ? <p className="text-sm text-destructive">{people.error.message}</p> : null}
    {people.data ? <Tabs defaultValue="tree"><TabsList><TabsTab value="tree"><Network />Tree</TabsTab><TabsTab value="list"><Users />List</TabsTab></TabsList><TabsPanel value="tree" className="mt-5"><Frame><FramePanel><div className="mb-5"><h2 className="text-sm font-semibold">Reporting tree</h2><p className="mt-1 text-xs text-muted-foreground">See who reports to whom. Select a card to expand everyone beneath that person.</p></div><Suspense fallback={<div className="grid h-[540px] place-items-center text-sm text-muted-foreground">Loading reporting tree…</div>}><ReportingTree people={people.data} /></Suspense></FramePanel></Frame></TabsPanel><TabsPanel value="list" className="mt-5"><Card><CardHeader><CardTitle>People</CardTitle><CardDescription>{people.data.length} team members</CardDescription></CardHeader><CardContent className="flex flex-col gap-1">{people.data.length ? people.data.map((person) => <PersonRow key={person.id} person={person} />) : <p className="px-2 py-5 text-sm text-muted-foreground">Add your first person to begin.</p>}</CardContent></Card></TabsPanel></Tabs> : null}
  </DashboardPage>
}

function PersonRow({ person }: { person: Person }) {
  const name = personName(person)
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <Link to="/dashboard/people/$personId" params={{ personId: person.id }} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left no-underline transition-colors duration-150 hover:bg-accent"><Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar><span><span className="block text-sm font-medium">{name}</span><span className="block text-xs text-muted-foreground">{person.title}</span></span></Link>
}

function CreateEmployee({ people }: { people: Person[] }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [managerEmploymentId, setManagerEmploymentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [open, setOpen] = useState(false)
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, role, email, personalEmail, managerEmploymentId, startDate }) })
      const payload = await response.json() as { person?: { id: string }; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not add this person.')
      return payload.person
    },
    onSuccess: async (person) => {
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['overview'] })
      setName(''); setRole(''); setEmail(''); setPersonalEmail(''); setManagerEmploymentId(''); setStartDate(''); setOpen(false)
      if (person?.id) void navigate({ to: '/dashboard/people/$personId', params: { personId: person.id } })
    },
  })
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate() }
  const managerItems = [{ label: 'No manager', value: '' }, ...people.map((person) => ({ label: personName(person), value: person.employment_id }))]
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button />}><Plus data-icon="inline-start" />Add person</DialogTrigger><DialogPopup className="max-h-[min(90dvh,760px)] sm:max-w-xl"><DialogHeader><DialogTitle>Add a person</DialogTitle><DialogDescription>Add their contact details here, then upload a photo and documents on their profile.</DialogDescription></DialogHeader><form className="contents" onSubmit={submit}><DialogPanel className="grid gap-4 overflow-y-auto sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-sm font-medium">Name<Input required value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Role<Input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Product designer" /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Work email <span className="font-normal text-muted-foreground">(optional)</span><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Personal email <span className="font-normal text-muted-foreground">(for invitation)</span><Input type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} placeholder="name@example.com" /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Joined on <span className="font-normal text-muted-foreground">(defaults to today)</span><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>{people.length ? <label className="flex flex-col gap-1.5 text-sm font-medium">Reports to <span className="font-normal text-muted-foreground">(optional)</span><Select items={managerItems} value={managerItems.find((item) => item.value === managerEmploymentId)} onValueChange={(item) => setManagerEmploymentId(item?.value ?? '')} itemToStringValue={(item) => item.label}><SelectTrigger aria-label="Reports to"><SelectValue /></SelectTrigger><SelectPopup>{managerItems.map((item) => <SelectItem key={item.value} value={item}>{item.label}</SelectItem>)}</SelectPopup></Select></label> : null}{create.isError ? <p className="text-sm text-destructive sm:col-span-2">{create.error.message}</p> : null}</DialogPanel><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button type="submit" loading={create.isPending}>Add person</Button></DialogFooter></form></DialogPopup></Dialog>
}
