import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ListFilter, Network, Plus, Search, SlidersHorizontal, UserMinus, Users } from 'lucide-react'
import { TeamEmptyState } from '#/components/team-empty-state'
import { DashboardPage } from '#/components/dashboard-page'
import { TableSkeleton } from '#/components/page-skeletons'
import { ReportingTree, initialsOf, presenceOf } from '#/components/reporting-tree'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Menu, MenuCheckboxItem, MenuGroup, MenuGroupLabel, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '#/components/ui/menu'
import { Tabs, TabsList, TabsPanel, TabsTab } from '#/components/ui/tabs'
import { formerPeopleQueryOptions, peopleQueryOptions, personName } from '#/lib/people-client'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'
import type { Person } from '#/lib/people-client'
import { cn } from '#/lib/utils'

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

function People() {
  const people = useQuery(peopleQueryOptions)
  const workspace = useWorkspace(true)
  const addButton = workspace.data?.permissions.people.write ? (
    <Button render={<Link to="/dashboard/people/new" />}>
      <Plus data-icon="inline-start" />
      Add person
    </Button>
  ) : undefined
  return (
    <DashboardPage title="People" description="Everyone in the company and who they report to." skeleton="table" actions={addButton}>
      {people.isPending ? <TableSkeleton /> : null}
      {people.isError ? <p className="text-sm text-destructive">{people.error.message}</p> : null}
      {people.data && !people.data.length ? <TeamEmptyState action={addButton} /> : null}
      {people.data?.length ? (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTab value="list"><Users />List</TabsTab>
            <TabsTab value="tree"><Network />Reporting tree</TabsTab>
            <TabsTab value="former"><UserMinus />Former</TabsTab>
          </TabsList>
          <TabsPanel value="list" className="mt-4">
            <PeopleTable people={people.data} />
          </TabsPanel>
          <TabsPanel value="tree" className="mt-4">
            <ReportingTree people={people.data} />
          </TabsPanel>
          <TabsPanel value="former" className="mt-4">
            <FormerPeople />
          </TabsPanel>
        </Tabs>
      ) : null}
    </DashboardPage>
  )
}

type SortKey = 'name' | 'title' | 'department' | 'start_date'

const accessBadges = {
  owner: { label: 'Owner', className: 'bg-primary/16 text-primary' },
  hr_admin: { label: 'HR admin', className: 'bg-primary/16 text-primary' },
  employee: { label: 'Member', className: 'bg-secondary text-secondary-foreground' },
  invited: { label: 'Invited', className: 'bg-primary/10 text-primary/80' },
} as const

/** A plain list of people in the style of a members page: search, filter and display controls, then rows. */
function PeopleTable({ people }: { people: Person[] }) {
  const [search, setSearch] = useState('')
  const [teams, setTeams] = useState<string[]>([])
  const [onlyAway, setOnlyAway] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false })
  const allTeams = useMemo(() => [...new Set(people.map((person) => person.department ?? 'No team'))].sort(), [people])
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const value = (person: Person) => sort.key === 'name' ? personName(person) : (person[sort.key] ?? '')
    return people
      .filter((person) => !term || [personName(person), person.title, person.department, person.work_email].some((field) => field?.toLowerCase().includes(term)))
      .filter((person) => (!teams.length || teams.includes(person.department ?? 'No team')) && (!onlyAway || Boolean(person.today_status)))
      .sort((a, b) => value(a).localeCompare(value(b)) * (sort.desc ? -1 : 1))
  }, [people, search, sort, teams, onlyAway])
  const grid = 'grid grid-cols-[minmax(10rem,1fr)_9rem] items-center gap-4 px-3 md:grid-cols-[minmax(12rem,1.4fr)_minmax(0,1fr)_9rem] xl:grid-cols-[minmax(12rem,1.4fr)_minmax(0,1fr)_6rem_5rem_8rem_9rem]'

  function header(key: SortKey, label: string, className?: string) {
    const active = sort.key === key
    return (
      <span role="columnheader" aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined} className={className}>
        <button type="button" className={cn('flex items-center gap-1 hover:text-foreground', active && 'text-foreground')} onClick={() => setSort({ key, desc: active ? !sort.desc : false })}>
          {label}
          {active && (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
        </button>
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full bg-transparent py-1 ps-6 text-sm outline-none placeholder:text-muted-foreground" placeholder="Find people…" aria-label="Find people" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="icon-sm" className="relative rounded-full" aria-label="Filter" />}>
            <ListFilter />
            {(teams.length > 0 || onlyAway) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuGroup>
              <MenuGroupLabel>Team</MenuGroupLabel>
              {allTeams.map((team) => <MenuCheckboxItem key={team} checked={teams.includes(team)} onCheckedChange={(checked) => setTeams((current) => checked ? [...current, team] : current.filter((value) => value !== team))}>{team}</MenuCheckboxItem>)}
            </MenuGroup>
            <MenuSeparator />
            <MenuCheckboxItem checked={onlyAway} onCheckedChange={setOnlyAway}>Away or remote today</MenuCheckboxItem>
          </MenuPopup>
        </Menu>
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="icon-sm" className="rounded-full" aria-label="Display options" />}><SlidersHorizontal /></MenuTrigger>
          <MenuPopup align="end">
            <MenuGroup>
              <MenuGroupLabel>Order by</MenuGroupLabel>
              <MenuRadioGroup value={sort.key} onValueChange={(value) => setSort({ key: value as SortKey, desc: false })}>
                <MenuRadioItem value="name">Name</MenuRadioItem>
                <MenuRadioItem value="title">Role</MenuRadioItem>
                <MenuRadioItem value="department">Team</MenuRadioItem>
                <MenuRadioItem value="start_date">Joined</MenuRadioItem>
              </MenuRadioGroup>
            </MenuGroup>
          </MenuPopup>
        </Menu>
      </div>
      <div role="table" aria-label="People">
        <div role="row" className={cn(grid, 'py-2 text-muted-foreground')}>
          {header('name', 'Name')}
          {header('title', 'Role', 'max-md:hidden')}
          <span role="columnheader" className="max-xl:hidden">Access</span>
          {header('start_date', 'Joined', 'max-xl:hidden')}
          {header('department', 'Team', 'max-xl:hidden')}
          <span role="columnheader">Today</span>
        </div>
        {rows.length ? rows.map((person) => {
          const name = personName(person)
          const status = presenceOf(person)
          const access = person.access ? accessBadges[person.access] : null
          return (
            <Link key={person.id} role="row" to="/dashboard/people/$personId" params={{ personId: person.id }} className={cn(grid, 'rounded-lg py-2.5 no-underline transition-colors hover:bg-accent/50')}>
              <span role="cell" className="flex min-w-0 items-center gap-3">
                <Avatar className="size-8">
                  {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
                  <AvatarFallback className="text-[11px]">{initialsOf(name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="block truncate text-muted-foreground">{person.work_email ?? 'No work email'}</span>
                </span>
              </span>
              <span role="cell" className="truncate max-md:hidden">{person.title}</span>
              <span role="cell" className="max-xl:hidden">{access ? <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', access.className)}>{access.label}</span> : <span className="text-muted-foreground">—</span>}</span>
              <span role="cell" className="tabular-nums text-muted-foreground max-xl:hidden">{new Date(`${person.start_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
              <span role="cell" className="flex min-w-0 items-center gap-1.5 max-xl:hidden"><Users className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{person.department ?? '—'}</span></span>
              <span role="cell" className="flex items-center gap-1.5 whitespace-nowrap"><span className={cn('size-2 rounded-full', status.dot)} />{status.label}</span>
            </Link>
          )
        }) : <p className="px-3 py-10 text-center text-muted-foreground">No one matches.</p>}
      </div>
    </div>
  )
}

const exitLabels: Record<string, string> = { resigned: 'Resigned', let_go: 'Let go', contract_ended: 'Contract ended', internship_ended: 'Internship ended', other: 'Other' }

/** People who have left. Records are kept for history; open one to rehire or, as owner, delete it for good. */
function FormerPeople() {
  const former = useQuery(formerPeopleQueryOptions)
  const format = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (former.isPending) return <TableSkeleton rows={3} />
  if (former.isError) return <p className="text-sm text-destructive">{former.error.message}</p>
  if (!former.data.length) return <p className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">No one has left yet. People you let go appear here with their records intact.</p>
  const grid = 'grid grid-cols-[minmax(10rem,1fr)_8rem] items-center gap-4 px-3 md:grid-cols-[minmax(12rem,1.4fr)_minmax(0,1fr)_7rem_7rem_9rem]'
  return (
    <div role="table" aria-label="Former people" className="text-sm">
      <div role="row" className={cn(grid, 'py-2 text-muted-foreground')}>
        <span role="columnheader">Name</span>
        <span role="columnheader" className="max-md:hidden">Role</span>
        <span role="columnheader" className="max-md:hidden">Joined</span>
        <span role="columnheader">Left</span>
        <span role="columnheader" className="max-md:hidden">Reason</span>
      </div>
      {former.data.map((person) => {
        const name = personName(person)
        return (
          <Link key={person.id} role="row" to="/dashboard/people/$personId" params={{ personId: person.id }} className={cn(grid, 'rounded-lg py-2.5 no-underline transition-colors hover:bg-accent/50')}>
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8 opacity-64 grayscale">
                {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
                <AvatarFallback className="text-[11px]">{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate font-medium">{name}</span>
                <span className="block truncate text-muted-foreground">{person.department ?? 'No team'}</span>
              </span>
            </span>
            <span role="cell" className="truncate max-md:hidden">{person.title}</span>
            <span role="cell" className="tabular-nums text-muted-foreground max-md:hidden">{format(person.start_date)}</span>
            <span role="cell" className="tabular-nums">{person.end_date ? format(person.end_date) : '—'}</span>
            <span role="cell" className="max-md:hidden"><span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{exitLabels[person.end_reason ?? ''] ?? 'Left'}</span></span>
          </Link>
        )
      })}
    </div>
  )
}
