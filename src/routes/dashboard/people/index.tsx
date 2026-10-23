import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { EmptyState } from '#/components/empty-state'
import { TeamEmptyState } from '#/components/team-empty-state'
import { Network, Plus, Users } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
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
  return <DashboardPage title="People" description="Your team's reporting structure." actions={workspace.data?.permissions.people.write ? <Button render={<Link to="/dashboard/people/new" />}><Plus data-icon="inline-start" />Add person</Button> : undefined}>
    {people.isPending ? <p className="text-sm text-muted-foreground">Loading people…</p> : null}
    {people.isError ? <p className="text-sm text-destructive">{people.error.message}</p> : null}
    {people.data && !people.data.length ? <TeamEmptyState action={workspace.data?.permissions.people.write ? <Button render={<Link to="/dashboard/people/new" />}><Plus data-icon="inline-start" />Add person</Button> : undefined} /> : null}
    {people.data?.length ? <Tabs defaultValue="tree"><TabsList><TabsTab value="tree"><Network />Tree</TabsTab><TabsTab value="list"><Users />List</TabsTab></TabsList><TabsPanel value="tree" className="mt-5"><Frame><FramePanel><div className="mb-5"><h2 className="text-sm font-semibold">Reporting tree</h2><p className="mt-1 text-xs text-muted-foreground">See who reports to whom. Select a card to expand everyone beneath that person.</p></div><Suspense fallback={<div className="grid h-[540px] place-items-center text-sm text-muted-foreground">Loading reporting tree…</div>}><ReportingTree people={people.data} /></Suspense></FramePanel></Frame></TabsPanel><TabsPanel value="list" className="mt-5"><Card><CardHeader><CardTitle>People</CardTitle><CardDescription>{people.data.length} team members</CardDescription></CardHeader><CardContent className="flex flex-col gap-1">{people.data.length ? people.data.map((person) => <PersonRow key={person.id} person={person} />) : <EmptyState icon={Users} title="No people yet" description="Add your first person to begin." />}</CardContent></Card></TabsPanel></Tabs> : null}
  </DashboardPage>
}

function PersonRow({ person }: { person: Person }) {
  const name = personName(person)
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <Link to="/dashboard/people/$personId" params={{ personId: person.id }} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left no-underline transition-colors duration-150 hover:bg-accent"><Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar><span><span className="block text-sm font-medium">{name}</span><span className="block text-xs text-muted-foreground">{person.title}</span></span></Link>
}

