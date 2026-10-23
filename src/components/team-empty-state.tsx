import { Link } from '@tanstack/react-router'
import { FileText, GitBranch, IdCard, Link2, Network, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { cn } from '#/lib/utils'

const features = [
  { icon: GitBranch, title: 'Reporting lines', description: 'Set who reports to whom and the tree builds itself.' },
  { icon: IdCard, title: 'Rich profiles', description: 'Work details, photos and private files for each person.' },
  { icon: Link2, title: 'Invite by link', description: 'Share a one-time link so people join on their own.' },
  { icon: FileText, title: 'Leave and payroll', description: 'Time off and payment records live on every profile.' },
]

const sample = [
  { initials: 'DL', role: 'Design lead', tone: 'bg-info/16 text-info-foreground', width: 'w-3/4' },
  { initials: 'EL', role: 'Engineering lead', tone: 'bg-success/16 text-success-foreground', width: 'w-1/2', highlight: true },
  { initials: 'OL', role: 'Operations lead', tone: 'bg-warning/16 text-warning-foreground', width: 'w-2/3' },
]

type TeamEmptyStateProps = {
  /** Primary call to action, usually the add-person dialog trigger. Hidden when the viewer cannot add people. */
  action?: React.ReactNode
  className?: string
}

export function TeamEmptyState({ action, className }: TeamEmptyStateProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="grid xl:grid-cols-2">
        <div className="flex flex-col gap-8 p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" size="lg">Team</Badge>
            <span className="text-sm text-muted-foreground">No one has been added yet</span>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">Build your team, one person at a time.</h2>
            <p className="max-w-md text-muted-foreground text-pretty">Add your first person and the reporting tree, profiles, leave and payroll all fall into place around them.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-card text-foreground shadow-sm/5"><Icon className="size-4" aria-hidden="true" /></span>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t pt-6">
            {action}
            <Button variant="ghost" render={<Link to="/dashboard/docs" />}>Learn more</Button>
          </div>
        </div>
        <div aria-hidden="true" className="relative grid place-items-center overflow-hidden border-t bg-muted/40 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[16px_16px] p-6 sm:p-10 xl:border-t-0 xl:border-l">
          <div className="flex w-full max-w-md flex-col items-center">
            <div className="flex w-full max-w-72 items-center gap-3 rounded-xl border bg-card p-4 shadow-sm/5">
              <Avatar><AvatarFallback className="bg-primary/16 text-primary"><UserRound className="size-4" /></AvatarFallback></Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">You</span>
                <span className="text-xs text-muted-foreground">Owner</span>
              </div>
              <Badge variant="outline">Root</Badge>
            </div>
            <span className="h-6 border-l border-dashed border-muted-foreground/50" />
            <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"><Network className="size-4" />Reporting tree</span>
            <span className="h-6 border-l border-dashed border-muted-foreground/50" />
            <div className="w-[calc(100%-4rem)] rounded-t-xl border-x border-t border-dashed border-muted-foreground/50 pt-0" />
            <div className="-mt-px grid w-full grid-cols-3 gap-2 sm:gap-3">
              {sample.map(({ initials, role, tone, width, highlight }) => (
                <div key={initials} className={cn('relative flex min-w-0 flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center shadow-sm/5', highlight && 'border-foreground/60 shadow-md/10')}>
                  {highlight ? <Badge variant="success" className="absolute -top-2.5">Next</Badge> : null}
                  <Avatar className="size-10"><AvatarFallback className={tone}>{initials}</AvatarFallback></Avatar>
                  <span className="w-full truncate text-xs font-medium">{role}</span>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full bg-foreground/70', width)} /></span>
                  <span className="font-mono text-[0.6875rem] text-muted-foreground">to add</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
