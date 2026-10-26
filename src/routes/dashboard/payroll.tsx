import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, ChevronDown, ChevronUp, CircleDollarSign, ListFilter, MapPin, Plus, Search } from 'lucide-react'
import { EmptyState } from '#/components/empty-state'
import { DashboardPage } from '#/components/dashboard-page'
import { TableSkeleton } from '#/components/page-skeletons'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { CardFrame, CardFrameFooter } from '#/components/ui/card'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Menu, MenuCheckboxItem, MenuGroup, MenuGroupLabel, MenuPopup, MenuSeparator, MenuTrigger } from '#/components/ui/menu'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '#/components/ui/pagination'
import { Popover, PopoverPopup, PopoverTrigger } from '#/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { Textarea } from '#/components/ui/textarea'
import { peopleQueryOptions, personName } from '#/lib/people-client'
import type { getPeople } from '#/lib/people-client'
import { cn } from '#/lib/utils'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'

type Status = 'draft' | 'scheduled' | 'paid' | 'void'
type Payment = {
  id: string
  amount: string
  currency: 'INR' | 'USD'
  status: Status
  type: string
  region: string | null
  paid_on: string | null
  period_start: string | null
  period_end: string | null
  notes: string | null
  created_at: string
  person_id: string
  first_name: string
  last_name: string | null
  avatar_url: string | null
  title: string
}

const statuses: Record<Status, { label: string; dot: string }> = {
  paid: { label: 'Paid', dot: 'bg-emerald-500' },
  scheduled: { label: 'Scheduled', dot: 'bg-sky-500' },
  draft: { label: 'Draft', dot: 'bg-muted-foreground/64' },
  void: { label: 'Void', dot: 'bg-red-500' },
}
/** Offered in the type dropdown even before any payment uses them; companies can add their own. */
const DEFAULT_TYPES = ['Salary', 'Stipend', 'Bonus', 'Reimbursement', 'Other']
const PAGE_SIZE = 10

function formatAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...decimals] = cleaned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimals.length ? `${grouped}.${decimals.join('').slice(0, 2)}` : grouped
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const paymentFormatters = {
  INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
}

function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function periodLabel(payment: Payment) {
  if (!payment.period_start) return '—'
  return new Date(`${payment.period_start}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

async function getPayments() {
  const response = await fetch('/api/payments')
  const payload = (await response.json()) as { payments?: Payment[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load payments.')
  return payload.payments ?? []
}

const paymentsQueryOptions = { queryKey: ['payments'] as const, queryFn: getPayments, staleTime: 60_000 }

export const Route = createFileRoute('/dashboard/payroll')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    const workspace = await context.queryClient.ensureQueryData(workspaceQueryOptions)
    await Promise.all([
      workspace?.permissions.people.read ? context.queryClient.ensureQueryData(peopleQueryOptions) : Promise.resolve(),
      context.queryClient.ensureQueryData(paymentsQueryOptions),
    ])
  },
  component: Payroll,
})

function Payroll() {
  const workspace = useWorkspace(true)
  const people = useQuery({ ...peopleQueryOptions, enabled: Boolean(workspace.data?.permissions.people.read) })
  const payments = useQuery(paymentsQueryOptions)
  return (
    <DashboardPage
      skeleton="table"
      wide
      title="Payments"
      description="Everything paid out, by type and region. Recording a payment does not move money."
      actions={workspace.data?.permissions.payroll.write ? <AddPayment people={people.data ?? []} payments={payments.data ?? []} disabled={!people.data?.length} /> : undefined}
    >
      {payments.isPending ? <TableSkeleton /> : null}
      {payments.isError ? <p className="py-5 text-sm text-destructive">{payments.error.message}</p> : null}
      {payments.data && !payments.data.length ? (
        <div className="rounded-xl border">
          <EmptyState icon={CircleDollarSign} title="No payments recorded yet" description={people.data?.length ? 'Use “Add payment” to create the first record.' : 'Add a person to your team before recording a payment.'}>
            {!people.data?.length ? <Button variant="outline" render={<Link to="/dashboard/people" />}>Add a person first<ArrowRight data-icon="inline-end" /></Button> : null}
          </EmptyState>
        </div>
      ) : null}
      {payments.data?.length ? <PaymentsTable payments={payments.data} /> : null}
    </DashboardPage>
  )
}

type SortKey = 'person' | 'type' | 'period' | 'amount' | 'date'

function PaymentsTable({ payments }: { payments: Payment[] }) {
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<Status[]>([])
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'date', desc: true })
  const [page, setPage] = useState(0)
  const allTypes = useMemo(() => [...new Set(payments.map((payment) => payment.type))].sort(), [payments])
  const allRegions = useMemo(() => [...new Set(payments.map((payment) => payment.region ?? 'No region'))].sort(), [payments])
  const filterCount = types.length + regions.length + statusFilter.length

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const value = (payment: Payment): string | number => {
      if (sort.key === 'person') return personName(payment)
      if (sort.key === 'type') return payment.type
      if (sort.key === 'period') return payment.period_start ?? ''
      if (sort.key === 'amount') return Number(payment.amount)
      return payment.paid_on ?? payment.created_at
    }
    return payments
      .filter((payment) => !term || [personName(payment), payment.type, payment.region, payment.notes].some((field) => field?.toLowerCase().includes(term)))
      .filter((payment) => (!types.length || types.includes(payment.type)) && (!regions.length || regions.includes(payment.region ?? 'No region')) && (!statusFilter.length || statusFilter.includes(payment.status)))
      .sort((a, b) => {
        const left = value(a), right = value(b)
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
        return sort.desc ? -order : order
      })
  }, [payments, search, types, regions, statusFilter, sort])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  // Totals per currency for whatever is filtered, paid only.
  const totals = rows.filter((payment) => payment.status === 'paid').reduce<Record<string, number>>((sum, payment) => ({ ...sum, [payment.currency]: (sum[payment.currency] ?? 0) + Number(payment.amount) }), {})

  function toggle<T>(list: T[], set: (next: T[]) => void, value: T, checked: boolean) {
    set(checked ? [...list, value] : list.filter((item) => item !== value))
    setPage(0)
  }

  function header(key: SortKey, label: string, className?: string) {
    const active = sort.key === key
    return (
      <TableHead className={className} aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined}>
        <button type="button" className={cn('flex w-full items-center gap-1.5 hover:text-foreground', className?.includes('text-right') && 'justify-end')} onClick={() => setSort({ key, desc: active ? !sort.desc : key === 'amount' || key === 'date' })}>
          {label}
          {active && (sort.desc ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />)}
        </button>
      </TableHead>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-8" placeholder="Find payments…" aria-label="Find payments" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {Object.entries(totals).map(([currency, amount]) => paymentFormatters[currency as 'INR' | 'USD'].format(amount)).join(' + ') || 'Nothing'} paid
          </p>
          <Menu>
            <MenuTrigger render={<Button variant="outline" size="sm" />}><ListFilter data-icon="inline-start" />Filter{filterCount ? <Badge variant="secondary" size="sm">{filterCount}</Badge> : null}</MenuTrigger>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Type</MenuGroupLabel>
                {allTypes.map((type) => <MenuCheckboxItem key={type} checked={types.includes(type)} onCheckedChange={(checked) => toggle(types, setTypes, type, checked)}>{type}</MenuCheckboxItem>)}
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Region</MenuGroupLabel>
                {allRegions.map((region) => <MenuCheckboxItem key={region} checked={regions.includes(region)} onCheckedChange={(checked) => toggle(regions, setRegions, region, checked)}>{region}</MenuCheckboxItem>)}
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Status</MenuGroupLabel>
                {(Object.keys(statuses) as Status[]).map((status) => <MenuCheckboxItem key={status} checked={statusFilter.includes(status)} onCheckedChange={(checked) => toggle(statusFilter, setStatusFilter, status, checked)}>{statuses[status].label}</MenuCheckboxItem>)}
              </MenuGroup>
              {filterCount > 0 && <><MenuSeparator /><MenuCheckboxItem checked={false} onCheckedChange={() => { setTypes([]); setRegions([]); setStatusFilter([]) }}>Clear filters</MenuCheckboxItem></>}
            </MenuPopup>
          </Menu>
        </div>
      </div>
      <CardFrame className="w-full">
        <Table variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {header('person', 'Person')}
              {header('type', 'Type')}
              <TableHead>Region</TableHead>
              {header('period', 'Period')}
              {header('amount', 'Amount', 'text-right')}
              <TableHead>Status</TableHead>
              {header('date', 'Paid on')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length ? visible.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  <Link to="/dashboard/people/$personId" params={{ personId: payment.person_id }} className="flex min-w-0 items-center gap-2.5 no-underline hover:text-primary">
                    <Avatar className="size-7">
                      {payment.avatar_url && <AvatarImage src={payment.avatar_url} alt="" />}
                      <AvatarFallback className="text-[10px]">{personName(payment).split(' ').map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{personName(payment)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{payment.notes ?? payment.title}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell><Badge variant="outline">{payment.type}</Badge></TableCell>
                <TableCell>{payment.region ? <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" />{payment.region}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{periodLabel(payment)}</TableCell>
                <TableCell className={cn('text-right font-medium tabular-nums', payment.status === 'void' && 'text-muted-foreground line-through')}>{paymentFormatters[payment.currency].format(Number(payment.amount))}</TableCell>
                <TableCell>
                  <Badge variant="outline"><span aria-hidden="true" className={cn('size-1.5 rounded-full', statuses[payment.status].dot)} />{statuses[payment.status].label}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{payment.paid_on ? shortDate(payment.paid_on) : '—'}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No payments match.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <CardFrameFooter className="p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Viewing <strong className="font-medium text-foreground tabular-nums">{rows.length ? `${current * PAGE_SIZE + 1}–${Math.min(rows.length, (current + 1) * PAGE_SIZE)}` : 0}</strong> of <strong className="font-medium text-foreground tabular-nums">{rows.length}</strong>
            </p>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem><PaginationPrevious className="sm:*:[svg]:hidden" render={<Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)} />} /></PaginationItem>
                <PaginationItem><PaginationNext className="sm:*:[svg]:hidden" render={<Button size="sm" variant="outline" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} />} /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardFrameFooter>
      </CardFrame>
    </div>
  )
}

function AddPayment({ people, payments, disabled }: { people: Awaited<ReturnType<typeof getPeople>>; payments: Payment[]; disabled: boolean }) {
  const queryClient = useQueryClient()
  const workspace = useWorkspace(true)
  const [open, setOpen] = useState(false)
  const [employmentId, setEmploymentId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [type, setType] = useState('Salary')
  const [newType, setNewType] = useState('')
  const [region, setRegion] = useState('')
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'paid'>('paid')
  const [paidOn, setPaidOn] = useState('')
  const [notes, setNotes] = useState('')
  const id = useId()
  const typeOptions = [...new Set([...DEFAULT_TYPES, ...payments.map((payment) => payment.type)])]
  const regionOptions = [...new Set(payments.map((payment) => payment.region).filter((value): value is string => Boolean(value)))]
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employmentId, amount: amount.replaceAll(',', ''), currency, status, paidOn, notes, type: type === '__new' ? newType : type, region, periodMonth }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not record payment.')
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['payments'] }), queryClient.invalidateQueries({ queryKey: ['overview'] })])
      setOpen(false)
      setEmploymentId('')
      setAmount('')
      setNotes('')
      setNewType('')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setCurrency(workspace.data?.default_currency ?? 'INR') }}>
      <DialogTrigger render={<Button disabled={disabled} />}><Plus data-icon="inline-start" />Add payment</DialogTrigger>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Add payment</DialogTitle>
          <DialogDescription>Record an amount for a person. This does not transfer funds.</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">Person
              <NativeSelect required value={employmentId} onChange={(event) => setEmploymentId(event.target.value)}>
                <NativeSelectOption value="">Choose a person</NativeSelectOption>
                {people.map((person) => <NativeSelectOption key={person.employment_id} value={person.employment_id}>{personName(person)}</NativeSelectOption>)}
              </NativeSelect>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">Type
                <NativeSelect value={type} onChange={(event) => setType(event.target.value)}>
                  {typeOptions.map((option) => <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>)}
                  <NativeSelectOption value="__new">+ New type…</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">Region
                <Input list={`${id}-regions`} value={region} placeholder="e.g. Bengaluru" onChange={(event) => setRegion(event.target.value)} />
                <datalist id={`${id}-regions`}>{regionOptions.map((option) => <option key={option} value={option} />)}</datalist>
              </label>
            </div>
            {type === '__new' && <label className="flex flex-col gap-1.5 text-sm font-medium">New type name<Input required autoFocus value={newType} placeholder="e.g. Joining bonus" maxLength={40} onChange={(event) => setNewType(event.target.value)} /></label>}
            <div className="grid gap-3 sm:grid-cols-[1fr_110px_1fr]">
              <label className="flex flex-col gap-1.5 text-sm font-medium">Amount<Input required inputMode="decimal" value={amount} onChange={(event) => setAmount(formatAmountInput(event.target.value))} placeholder="0.00" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">Currency
                <NativeSelect value={currency} onChange={(event) => setCurrency(event.target.value as 'INR' | 'USD')}><NativeSelectOption value="INR">INR</NativeSelectOption><NativeSelectOption value="USD">USD</NativeSelectOption></NativeSelect>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">For month<Input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">Status
                <NativeSelect value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                  <NativeSelectOption value="paid">Paid</NativeSelectOption>
                  <NativeSelectOption value="scheduled">Scheduled</NativeSelectOption>
                  <NativeSelectOption value="draft">Draft</NativeSelectOption>
                </NativeSelect>
              </label>
              {status === 'paid' && (
                <div className="flex flex-col gap-1.5 text-sm font-medium">Paid on
                  <Popover><PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-start" />}><CalendarDays data-icon="inline-start" />{paidOn || 'Choose date'}</PopoverTrigger><PopoverPopup><Calendar mode="single" selected={paidOn ? new Date(`${paidOn}T12:00:00`) : undefined} onSelect={(date) => { if (date) setPaidOn(localDateString(date)) }} /></PopoverPopup></Popover>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between"><Label htmlFor={`${id}-note`}>Note</Label><span className="text-sm text-muted-foreground">Optional</span></div>
              <Textarea id={`${id}-note`} placeholder="e.g. October salary, 2 unpaid days deducted" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            {create.isError ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" loading={create.isPending}>Save payment</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
