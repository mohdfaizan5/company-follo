import type { ReactNode } from 'react'
import { CalendarDays, CircleDollarSign, FileText, ShieldCheck, UserRound } from 'lucide-react'

type Feature = {
  title: string
  description: string
  visual: ReactNode
}

const features: Feature[] = [
  {
    title: 'A home for every person',
    description: 'Keep contact details, role history, documents and notes together.',
    visual: <PeopleVisual />,
  },
  {
    title: 'A team shape you can read',
    description: 'See reporting lines without turning your team into an org-chart project.',
    visual: <ReportingVisual />,
  },
  {
    title: 'Leave in plain sight',
    description: 'Bring holidays, leave requests and balances into one shared calendar.',
    visual: <CalendarVisual />,
  },
  {
    title: 'The company handbook, finally useful',
    description: 'Write policies and SOPs where your team can actually find them.',
    visual: <DocsVisual />,
  },
  {
    title: 'Payments without the noise',
    description: 'Record salaries, bonuses and the dates they were paid.',
    visual: <PayrollVisual />,
  },
  {
    title: 'Access that stays intentional',
    description: 'Set what owners, HR and employees can see or update.',
    visual: <PermissionsVisual />,
  },
]

export function LandingFeatures() {
  return <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-5 pb-24 sm:pb-32">
    <div className="flex items-center gap-4"><span className="h-px flex-1 bg-border" /><p className="shrink-0 text-sm font-medium text-muted-foreground">Made for the everyday company work</p><span className="h-px flex-1 bg-border" /></div>
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:gap-5">
      {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
    </div>
    <div className="mt-16 border-t pt-8 sm:mt-20"><h2 id="features-heading" className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-4xl">The calm layer underneath your company.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">CompanyFollo keeps the small but important details together, so your team can stay focused on its work.</p></div>
  </section>
}

function FeatureCard({ title, description, visual }: Feature) {
  return <article className="group rounded-2xl border bg-card p-5 shadow-[0_1px_0_rgb(255_255_255_/_0.03%)] transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-input hover:bg-secondary sm:p-6">
    <div className="mb-7 h-36 overflow-hidden rounded-xl bg-background p-4 sm:h-40">{visual}</div>
    <h3 className="text-lg font-semibold tracking-[-0.025em]">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </article>
}

function PeopleVisual() {
  return <div className="flex h-full items-center gap-3"><div className="grid size-16 shrink-0 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary"><UserRound className="size-7" /></div><div className="min-w-0 flex-1 space-y-2"><div className="h-3 w-28 rounded-full bg-foreground/75" /><div className="h-2.5 w-20 rounded-full bg-muted-foreground/35" /><div className="mt-4 flex gap-1.5"><span className="h-5 w-16 rounded-md bg-secondary" /><span className="h-5 w-20 rounded-md bg-secondary" /></div></div></div>
}

function ReportingVisual() {
  return <div className="relative flex h-full items-center justify-center"><div className="absolute top-4 h-7 border-l border-primary/70" /><div className="absolute top-11 h-px w-40 bg-primary/70" /><TreeNode className="absolute top-0" /><TreeNode className="absolute left-[calc(50%-6rem)] top-12" muted /><TreeNode className="absolute right-[calc(50%-6rem)] top-12" muted /></div>
}

function TreeNode({ className = '', muted = false }: { className?: string; muted?: boolean }) {
  return <div className={`flex w-20 items-center gap-1.5 rounded-lg border px-2 py-1.5 ${muted ? 'border-border bg-secondary' : 'border-primary/45 bg-primary/10'} ${className}`}><span className={`size-3 rounded-full ${muted ? 'bg-muted-foreground/50' : 'bg-primary'}`} /><span className="h-1.5 flex-1 rounded-full bg-muted-foreground/35" /></div>
}

function CalendarVisual() {
  const days = ['M', 'T', 'W', 'T', 'F']
  return <div className="h-full"><div className="flex items-center justify-between"><CalendarDays className="size-4 text-primary" /><span className="text-xs font-medium text-muted-foreground">This week</span></div><div className="mt-4 grid grid-cols-5 gap-2">{days.map((day, index) => <div key={`${day}-${index}`} className="text-center"><p className="text-[10px] text-muted-foreground">{day}</p><span className={`mt-2 block h-12 rounded-md ${index === 2 ? 'bg-primary/25 ring-1 ring-primary/50' : index === 4 ? 'bg-secondary' : 'bg-muted'}`} /></div>)}</div></div>
}

function DocsVisual() {
  return <div className="flex h-full flex-col justify-center"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" /><span className="text-xs font-medium text-foreground">Working agreements</span></div><div className="mt-4 space-y-2"><div className="h-2.5 w-4/5 rounded-full bg-foreground/70" /><div className="h-2.5 w-full rounded-full bg-muted-foreground/30" /><div className="h-2.5 w-3/5 rounded-full bg-muted-foreground/30" /></div><span className="mt-4 w-fit rounded-md bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary">Shared with the team</span></div>
}

function PayrollVisual() {
  return <div className="flex h-full items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><CircleDollarSign className="size-6" /></span><div className="min-w-0 flex-1"><p className="text-xl font-semibold tracking-[-0.04em] tabular-nums">₹ 1,20,000</p><p className="mt-1 text-xs text-muted-foreground">Paid on 28 Oct</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full w-4/5 rounded-full bg-primary" /></div></div></div>
}

function PermissionsVisual() {
  return <div className="h-full"><div className="flex items-center justify-between"><ShieldCheck className="size-4 text-primary" /><span className="rounded-md bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary">HR admin</span></div><div className="mt-4 space-y-2.5">{['People', 'Calendar', 'Docs'].map((label, index) => <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs"><span className="text-muted-foreground">{label}</span><span className="text-muted-foreground">View</span><span className={`size-3 rounded-sm ${index < 2 ? 'bg-primary' : 'bg-secondary ring-1 ring-border'}`} /></div>)}</div></div>
}
