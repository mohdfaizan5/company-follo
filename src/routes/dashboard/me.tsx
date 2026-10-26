import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, CalendarDays, FileText, ListChecks, Mail, MapPin, Phone, ScrollText, Shield, Wallet } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { EmptyState } from '#/components/empty-state'
import { CardsSkeleton } from '#/components/page-skeletons'
import { categoryOf, categoryStyles, formatDay, formatRange, holidayStyle } from '#/components/time-off-calendar'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { cn } from '#/lib/utils'

export type Leave = { id: string; start_date: string; end_date: string; duration_days: string; reason: string | null; status: string; entry_type: string; policy_name: string; policy_category: string }
type Payment = { id: string; amount: string; currency: 'INR' | 'USD'; status: string; paid_on: string | null; period_start: string | null; period_end: string | null; notes: string | null; created_at: string }
export type Me = {
  company: { name: string; logo_url: string | null; currency: 'INR' | 'USD'; working_days: number[]; role: string }
  person: null | {
    id: string; first_name: string; last_name: string | null; work_email: string | null; personal_email: string | null; phone_number: string | null; address: string | null; avatar_url: string | null
    title: string; department: string | null; level: string | null; start_date: string
  }
  holidays: { id: string; name: string; kind: string; date: string }[]
  docs: { id: string; title: string; kind: string; updated_at: string }[]
  leaveTypes: { id: string; name: string; category: string; allow_half_days: boolean }[]
  leave: Leave[]
  balances: { policy_id: string; name: string; earned: number; carried: number; used: number; available: number }[]
  payments: Payment[]
  today: string
}

async function getMe() {
  const response = await fetch('/api/me')
  const payload = await response.json() as Me & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load your space.')
  return payload
}

export const meQueryOptions = { queryKey: ['me'] as const, queryFn: getMe, staleTime: 60_000 }

export const Route = createFileRoute('/dashboard/me')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    void context.queryClient.prefetchQuery(meQueryOptions)
  },
  component: MyPage,
})

function MyPage() {
  const me = useQuery(meQueryOptions)
  return (
    <DashboardPage title="My space" description="Your details, time off, pay and company docs." skeleton="profile">
      {me.isPending && <CardsSkeleton />}
      {me.isError && <p className="text-sm text-destructive">{me.error.message}</p>}
      {me.data && <MyContent data={me.data} />}
    </DashboardPage>
  )
}

function money(amount: string | number, currency: 'INR' | 'USD') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))
}

function workdaysBetween(start: string, end: string, workingDays: number[], holidays: Set<string>) {
  let count = 0
  for (let ms = Date.parse(`${start}T00:00:00Z`); ms <= Date.parse(`${end}T00:00:00Z`); ms += 86400000) {
    const date = new Date(ms)
    if (workingDays.includes(date.getUTCDay()) && !holidays.has(date.toISOString().slice(0, 10))) count++
  }
  return count
}

function MyContent({ data }: { data: Me }) {
  const { person } = data
  if (!person) {
    return <EmptyState icon={FileText} title="Your record isn't linked yet" description="Ask HR to add you in People with this email address, or to send you an invitation. Company docs and holidays are below." />
  }
  const name = `${person.first_name} ${person.last_name ?? ''}`.trim()
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
          <AvatarFallback className="text-lg">{name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">{name}</h2>
          <p className="text-sm text-muted-foreground">{person.title}{person.department ? ` · ${person.department}` : ''}</p>
          <p className="text-xs text-muted-foreground">Joined {formatDay(person.start_date, true)}</p>
        </div>
      </section>

      <LeaveSummary data={data} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <MyLeave data={data} />
        <div className="flex flex-col gap-5">
          <UpcomingHolidays data={data} />
          <Card>
            <CardHeader><CardTitle>Contact details</CardTitle><CardDescription>Ask HR to change these.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              <Detail icon={Mail} value={person.work_email} label="Work email" />
              <Detail icon={Mail} value={person.personal_email} label="Personal email" />
              <Detail icon={Phone} value={person.phone_number} label="Phone" />
              <Detail icon={MapPin} value={person.address} label="Address" />
            </CardContent>
          </Card>
        </div>
      </div>

      <MyPay data={data} />
      <MyDocs data={data} />
    </div>
  )
}

function Detail({ icon: Icon, value, label }: { icon: typeof Mail; value: string | null; label: string }) {
  return <p className="flex items-start gap-2.5"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={label} /><span className={cn('min-w-0 break-words', !value && 'text-muted-foreground')}>{value || `No ${label.toLowerCase()}`}</span></p>
}

/** Days left for each paid leave type, and what it means for pay when someone goes over. */
function LeaveSummary({ data }: { data: Me }) {
  const year = data.today.slice(0, 4)
  const unpaidDays = data.leave
    .filter((item) => item.status === 'approved' && categoryOf(item.policy_category) === 'unpaid' && item.start_date.startsWith(year))
    .reduce((sum, item) => sum + Number(item.duration_days), 0)
  const overdrawn = data.balances.reduce((sum, balance) => sum + Math.max(0, -balance.available), 0)
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Leave this year</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.balances.map((balance) => (
          <div key={balance.policy_id} className={cn('rounded-xl border bg-card p-4', balance.available < 0 && 'border-destructive/40')}>
            <p className="text-sm text-muted-foreground">{balance.name}</p>
            <p className={cn('mt-1 text-2xl font-semibold tabular-nums', balance.available < 0 && 'text-destructive')}>
              {balance.available < 0 ? `${-balance.available} over` : `${balance.available} left`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{balance.used} used of {Math.round((balance.earned + balance.carried) * 10) / 10} earned{balance.carried ? ` (incl. ${balance.carried} carried over)` : ''}</p>
          </div>
        ))}
        <div className={cn('rounded-xl border bg-card p-4', unpaidDays > 0 && 'border-amber-500/40')}>
          <p className="text-sm text-muted-foreground">Unpaid days</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{unpaidDays}</p>
          <p className="mt-1 text-xs text-muted-foreground">{unpaidDays ? 'Deducted from pay at one day’s pay each.' : 'Nothing deducted this year.'}</p>
        </div>
      </div>
      {overdrawn > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          You have taken {overdrawn} more paid {overdrawn === 1 ? 'day' : 'days'} than you have earned. Unless HR records them differently, they are deducted from your pay like unpaid days.
        </p>
      )}
    </section>
  )
}

function payImpact(leave: Leave) {
  const category = categoryOf(leave.policy_category)
  if (category === 'wfh') return <span className="text-muted-foreground">No effect</span>
  if (category === 'unpaid') return <span className="text-amber-600 dark:text-amber-400">{Number(leave.duration_days)} {Number(leave.duration_days) === 1 ? 'day' : 'days'} deducted</span>
  return <span className="text-muted-foreground">Paid</span>
}

function MyLeave({ data }: { data: Me }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-base font-semibold">My leave</h2>
      {data.leave.length ? (
        <Table variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.leave.map((leave) => {
              const style = categoryStyles[categoryOf(leave.policy_category)]
              return (
                <TableRow key={leave.id}>
                  <TableCell>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', style.chip)}><span className={cn('size-1.5 rounded-full', style.dot)} />{leave.policy_name}</span>
                    {leave.reason && <span className="mt-1 block max-w-56 truncate text-xs text-muted-foreground">{leave.reason}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatRange(leave.start_date, leave.end_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(leave.duration_days)}</TableCell>
                  <TableCell>{leave.status === 'pending' ? <Badge variant="warning">Awaiting approval</Badge> : leave.status === 'approved' ? <Badge variant="success">Approved</Badge> : <Badge variant="secondary" className="capitalize">{leave.status}</Badge>}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{leave.status === 'approved' ? payImpact(leave) : <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : <div className="rounded-xl border"><EmptyState icon={CalendarDays} title="No leave yet" description="Leave HR records for you shows up here." /></div>}
    </section>
  )
}

function UpcomingHolidays({ data }: { data: Me }) {
  const upcoming = data.holidays.filter((holiday) => holiday.date >= data.today).slice(0, 6)
  const thisYear = data.holidays.filter((holiday) => holiday.date.startsWith(data.today.slice(0, 4)))
  const left = thisYear.filter((holiday) => holiday.date >= data.today).length
  return (
    <Card>
      <CardHeader><CardTitle>Upcoming holidays</CardTitle><CardDescription>{left} of {thisYear.length} holidays left this year.</CardDescription></CardHeader>
      <CardContent>
        {upcoming.length ? upcoming.map((holiday) => (
          <div key={holiday.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className={cn('w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-medium tabular-nums', holidayStyle.chip)}>{formatDay(holiday.date)}</span>
            <span className="min-w-0 flex-1 truncate">{holiday.name}</span>
          </div>
        )) : <p className="text-sm text-muted-foreground">No more holidays this year.</p>}
      </CardContent>
    </Card>
  )
}

/** Payments with the unpaid leave that falls inside each pay period, so deductions are easy to follow. */
function MyPay({ data }: { data: Me }) {
  const holidays = new Set(data.holidays.map((holiday) => holiday.date))
  const unpaid = data.leave.filter((item) => item.status === 'approved' && categoryOf(item.policy_category) === 'unpaid')
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">My pay</h2>
      {data.payments.length ? (
        <Table variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Period</TableHead>
              <TableHead>Paid on</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deductions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.payments.map((payment) => {
              // Without an explicit period, use the calendar month the payment was made in.
              const anchor = payment.paid_on ?? payment.created_at.slice(0, 10)
              const start = payment.period_start ?? `${anchor.slice(0, 7)}-01`
              const end = payment.period_end ?? new Date(Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0)).toISOString().slice(0, 10)
              const lines = unpaid.flatMap((item) => {
                const from = item.start_date > start ? item.start_date : start
                const to = item.end_date < end ? item.end_date : end
                if (from > to) return []
                const days = workdaysBetween(from, to, data.company.working_days, holidays)
                return days ? [`${days} unpaid ${days === 1 ? 'day' : 'days'} (${formatRange(from, to)})`] : []
              })
              return (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatRange(start, end)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{payment.paid_on ? formatDay(payment.paid_on, true) : '—'}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(payment.amount, payment.currency)}</TableCell>
                  <TableCell>{payment.status === 'paid' ? <Badge variant="success">Paid</Badge> : <Badge variant="info">Scheduled</Badge>}</TableCell>
                  <TableCell className="text-sm">{lines.length ? lines.map((line) => <span key={line} className="block text-amber-600 dark:text-amber-400">{line}</span>) : <span className="text-muted-foreground">None</span>}{payment.notes && <span className="block text-xs text-muted-foreground">{payment.notes}</span>}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : <div className="rounded-xl border"><EmptyState icon={Wallet} title="No payments yet" description="Your payments appear here once HR records them." /></div>}
    </section>
  )
}

const docIcons: Record<string, typeof FileText> = { policy: Shield, sop: ListChecks, guide: BookOpen, general: ScrollText }

function MyDocs({ data }: { data: Me }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Company docs</h2>
      {data.docs.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.docs.map((doc) => {
            const Icon = docIcons[doc.kind] ?? FileText
            return (
              <Link key={doc.id} to="/dashboard/handbook/$documentId" params={{ documentId: doc.id }} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm no-underline transition-colors hover:bg-accent/50">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
              </Link>
            )
          })}
        </div>
      ) : <div className="rounded-xl border"><EmptyState icon={FileText} title="No docs yet" description="Published company policies and guides show up here." /></div>}
    </section>
  )
}
