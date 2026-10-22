import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, CircleDollarSign, Users } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'

type Overview = {
  peopleCount: number
  pendingLeaveCount: number
  paymentsThisMonthCount: number
  recentPeople: { id: string; first_name: string; last_name: string | null; title: string }[]
}

export async function getOverview() {
  const response = await fetch('/api/overview')
  const payload = await response.json() as Overview & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load your overview.')
  return payload
}

export const overviewQueryOptions = {
  queryKey: ['overview'] as const,
  queryFn: getOverview,
  staleTime: 60_000,
}

export const Route = createFileRoute('/dashboard/')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions),
      context.queryClient.ensureQueryData(overviewQueryOptions),
    ])
  },
  component: Dashboard,
})

function Dashboard() {
  return <DashboardPage title="At a glance" description="Your company, as it stands today."><OverviewContent /></DashboardPage>
}

function OverviewContent() {
  const overview = useQuery(overviewQueryOptions)
  const { data: workspace } = useWorkspace(true)
  if (overview.isPending) return <p className="text-sm text-muted-foreground">Loading your overview…</p>
  if (overview.isError) return <p className="text-sm text-destructive">{overview.error.message}</p>
  const data = overview.data
  const can = workspace?.permissions

  return <>
    <div className="grid gap-3 md:grid-cols-3">
      {can?.people.read && <Metric icon={<Users />} label="People" value={data.peopleCount} detail="Active team members" />}
      {can?.calendar.read && <Metric icon={<CalendarDays />} label="Leave to review" value={data.pendingLeaveCount} detail="Pending requests" />}
      {can?.payroll.read && <Metric icon={<CircleDollarSign />} label="Payments" value={data.paymentsThisMonthCount} detail="Recorded this month" />}
    </div>
    <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      {can?.people.read && <Card>
        <CardHeader><CardTitle>Recently added people</CardTitle><CardDescription>The latest people in your company.</CardDescription></CardHeader>
        <CardContent>
          {data.recentPeople.length ? <div className="divide-y divide-border">{data.recentPeople.map((person) => <Link key={person.id} to="/dashboard/people/$personId" params={{ personId: person.id }} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm no-underline transition-colors duration-150 hover:text-primary"><span><span className="block font-medium">{person.first_name} {person.last_name}</span><span className="block text-xs text-muted-foreground">{person.title}</span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>)}</div> : <div className="py-5"><p className="text-sm text-muted-foreground">Your team is empty. Add the first person to start their record.</p><Button className="mt-4" render={<Link to="/dashboard/people" />}>Open People<ArrowRight data-icon="inline-end" /></Button></div>}
        </CardContent>
      </Card>}
      <Card>
        <CardHeader><CardTitle>Keep it up to date</CardTitle><CardDescription>Small records make the overview useful.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {can?.people.read && <Link to="/dashboard/people" className="flex min-h-11 items-center justify-between rounded-md border px-3 no-underline transition-colors duration-150 hover:bg-accent"><span>Manage people</span><ArrowRight className="size-4 text-muted-foreground" /></Link>}
          {can?.calendar.read && <Link to="/dashboard/time-off" className="flex min-h-11 items-center justify-between rounded-md border px-3 no-underline transition-colors duration-150 hover:bg-accent"><span>Review leave and holidays</span><ArrowRight className="size-4 text-muted-foreground" /></Link>}
          {can?.docs.read && <Link to="/dashboard/docs" className="flex min-h-11 items-center justify-between rounded-md border px-3 no-underline transition-colors duration-150 hover:bg-accent"><span>Company docs</span><ArrowRight className="size-4 text-muted-foreground" /></Link>}
          {can?.payroll.read && <Link to="/dashboard/payroll" className="flex min-h-11 items-center justify-between rounded-md border px-3 no-underline transition-colors duration-150 hover:bg-accent"><span>Payments</span><ArrowRight className="size-4 text-muted-foreground" /></Link>}
          {!can?.people.read && !can?.calendar.read && !can?.docs.read && !can?.payroll.read && <p className="text-muted-foreground">Your owner can grant access to workspace areas in Settings.</p>}
        </CardContent>
      </Card>
    </div>
  </>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return <Card><CardContent className="pt-6"><span className="grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground">{icon}</span><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>
}
