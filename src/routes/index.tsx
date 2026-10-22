import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CircleDollarSign, Network, UserRound } from 'lucide-react'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return <main className="min-h-svh bg-background">
    <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"><Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-[-0.02em] text-foreground no-underline"><span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] text-primary-foreground">C</span>CompanyFollo</Link><div className="flex items-center gap-2"><Button variant="ghost" render={<Link to="/login" />}>Log in</Button><Button render={<Link to="/dashboard" />}>Get started<ArrowRight data-icon="inline-end" /></Button></div></header>
    <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-24 lg:grid-cols-[1fr_0.85fr] lg:items-center">
      <div><p className="text-sm font-medium text-primary">For small teams with real work to do</p><h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-balance sm:text-6xl">The quieter way to keep your company together.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Keep your people, reporting lines, payment records, and notes in one calm workspace.</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" render={<Link to="/dashboard" />}>Get started<ArrowRight data-icon="inline-end" /></Button></div></div>
      <div className="rounded-xl border bg-card p-6"><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">One place to start</p><div className="mt-6 space-y-3"><Feature icon={<UserRound />} title="People records" detail="Keep contact and work details together." /><Feature icon={<Network />} title="Reporting tree" detail="See who reports to whom as your team grows." /><Feature icon={<CircleDollarSign />} title="Payment history" detail="Record amounts and dates in INR or USD." /></div><p className="mt-6 border-t pt-5 text-sm text-muted-foreground">Your dashboard shows your own company data after setup.</p></div>
    </section>
  </main>
}

function Feature({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex gap-3 rounded-lg border bg-background p-4"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">{icon}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>
}
