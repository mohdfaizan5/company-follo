import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Maximize2, Minus, Network, Plus } from 'lucide-react'
import { EmptyState } from '#/components/empty-state'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Group } from '#/components/ui/group'
import { Tooltip, TooltipPopup, TooltipTrigger } from '#/components/ui/tooltip'
import { personName } from '#/lib/people-client'
import type { Person } from '#/lib/people-client'
import { cn } from '#/lib/utils'

const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.15]

/** Dot colour and label for where someone is today. */
export const presence = {
  in: { label: 'Working today', dot: 'bg-emerald-500' },
  wfh: { label: 'Working from home', dot: 'bg-sky-500' },
  paid: { label: 'On leave', dot: 'bg-amber-500' },
  unpaid: { label: 'On leave', dot: 'bg-amber-500' },
} as const

export function presenceOf(person: Person) {
  return presence[person.today_status ?? 'in']
}

export function initialsOf(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function ReportingTree({ people }: { people: Person[] }) {
  const [zoom, setZoom] = useState(3)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const { roots, reportsOf } = useMemo(() => {
    const known = new Set(people.map((person) => person.employment_id))
    const byManager = new Map<string, Person[]>()
    for (const person of people) {
      if (!person.manager_employment_id || !known.has(person.manager_employment_id)) continue
      byManager.set(person.manager_employment_id, [...(byManager.get(person.manager_employment_id) ?? []), person])
    }
    return {
      roots: people.filter((person) => !person.manager_employment_id || !known.has(person.manager_employment_id)),
      reportsOf: (id: string) => byManager.get(id) ?? [],
    }
  }, [people])

  if (!people.length)
    return <EmptyState icon={Network} title="No reporting tree yet" description="Add your first person and the tree builds itself as you set who reports to whom." />

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function branch(person: Person, seen: Set<string>): React.ReactNode {
    if (seen.has(person.employment_id)) return null
    const nextSeen = new Set(seen).add(person.employment_id)
    const reports = reportsOf(person.employment_id)
    const open = !collapsed.has(person.employment_id)
    return (
      <li key={person.employment_id}>
        <PersonNode person={person} reportCount={reports.length} open={open} onToggle={() => toggle(person.employment_id)} />
        {open && reports.length > 0 && <ul>{reports.map((report) => branch(report, nextSeen))}</ul>}
      </li>
    )
  }

  const scale = ZOOM_STEPS[zoom]
  return (
    <div className="relative overflow-hidden rounded-xl border bg-[radial-gradient(var(--color-muted)_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="max-h-[560px] min-h-80 overflow-auto px-6 py-8">
        {/* CSS zoom (not transform) so the scroll area shrinks and grows with the tree. */}
        <div className="org-tree mx-auto w-max" style={{ zoom: scale }}>
          <ul>{roots.map((root) => branch(root, new Set()))}</ul>
        </div>
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-2">
        <span className="rounded-md bg-background/80 px-2 py-1 text-xs tabular-nums text-muted-foreground backdrop-blur">{Math.round(scale * 100)}%</span>
        <Group aria-label="Zoom">
          <Button size="icon-sm" variant="outline" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}><Minus /></Button>
          <Button size="icon-sm" variant="outline" aria-label="Reset zoom" onClick={() => { setZoom(3); setCollapsed(new Set()) }}><Maximize2 /></Button>
          <Button size="icon-sm" variant="outline" aria-label="Zoom in" disabled={zoom === ZOOM_STEPS.length - 1} onClick={() => setZoom(zoom + 1)}><Plus /></Button>
        </Group>
      </div>
    </div>
  )
}

function PersonNode({ person, reportCount, open, onToggle }: { person: Person; reportCount: number; open: boolean; onToggle: () => void }) {
  const name = personName(person)
  const status = presenceOf(person)
  return (
    <div className="flex flex-col items-center">
      <Link
        to="/dashboard/people/$personId"
        params={{ personId: person.id }}
        className="group flex w-40 flex-col items-center rounded-2xl border bg-card px-3 pt-4 pb-3 text-center no-underline shadow-xs/5 transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        <span className="relative">
          <Avatar className="size-12 ring-2 ring-background">
            {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
            <AvatarFallback className="text-sm">{initialsOf(name)}</AvatarFallback>
          </Avatar>
          <Tooltip>
            <TooltipTrigger render={<span className={cn('absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-card', status.dot)} aria-label={status.label} />} />
            <TooltipPopup>{status.label}</TooltipPopup>
          </Tooltip>
        </span>
        <span className="mt-2.5 w-full truncate text-sm font-medium">{name}</span>
        <span className="w-full truncate text-xs text-muted-foreground">{person.title}</span>
        {person.department && <span className="mt-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{person.department}</span>}
      </Link>
      {reportCount > 0 && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} ${reportCount} ${reportCount === 1 ? 'report' : 'reports'} of ${name}`}
          className="relative z-1 -mt-2.5 flex h-5 items-center gap-0.5 rounded-full border bg-background px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:text-foreground"
        >
          {reportCount}
          <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}
