import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Ellipsis,
  Gift,
  ListFilter,
  MapPin,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react'
import { EmptyState } from '#/components/empty-state'
import { DashboardPage } from '#/components/dashboard-page'
import { appToast } from '#/lib/toast'
import { TableSkeleton } from '#/components/page-skeletons'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { CardFrame, CardFrameFooter } from '#/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Group, GroupSeparator } from '#/components/ui/group'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '#/components/ui/menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '#/components/ui/pagination'
import { Popover, PopoverPopup, PopoverTrigger } from '#/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Textarea } from '#/components/ui/textarea'
import { Tabs, TabsList, TabsPanel, TabsTab } from '#/components/ui/tabs'
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  formerPeopleQueryOptions,
  peopleQueryOptions,
  personName,
} from '#/lib/people-client'
import type { getPeople, Person } from '#/lib/people-client'
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
const paymentTypeOptions = [
  { value: 'Salary', label: 'Salary', icon: WalletCards },
  { value: 'Stipend', label: 'Stipend', icon: Banknote },
  { value: 'Bonus', label: 'Bonus', icon: Gift },
  { value: 'Reimbursement', label: 'Reimbursement', icon: ReceiptText },
]

function formatAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...decimals] = cleaned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimals.length
    ? `${grouped}.${decimals.join('').slice(0, 2)}`
    : grouped
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const paymentFormatters = {
  INR: new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
}

function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  )
}

function periodLabel(payment: Payment) {
  if (!payment.period_start) return '—'
  return new Date(`${payment.period_start}T00:00:00Z`).toLocaleDateString(
    'en-GB',
    { month: 'short', year: 'numeric', timeZone: 'UTC' },
  )
}

async function getPayments(page = 1, person?: string) {
  const response = await fetch(
    `/api/payments?page=${page}&pageSize=${PAGE_SIZE}${person ? `&person=${encodeURIComponent(person)}` : ''}`,
  )
  const payload = (await response.json()) as {
    payments?: Payment[]
    page?: number
    pageSize?: number
    total?: number
    error?: string
  }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load payments.')
  return {
    payments: payload.payments ?? [],
    page: payload.page ?? page,
    pageSize: payload.pageSize ?? PAGE_SIZE,
    total: payload.total ?? 0,
  }
}

const paymentsQueryOptions = (page = 1, person?: string) => ({
  queryKey: ['payments', page, person ?? 'all'] as const,
  queryFn: () => getPayments(page, person),
  staleTime: 60_000,
})

export const Route = createFileRoute('/dashboard/payroll')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: 'payments' | 'expenses'; person?: string } => ({
    view:
      search.view === 'expenses' || search.view === 'payments'
        ? search.view
        : undefined,
    person:
      typeof search.person === 'string' &&
      /^[0-9a-f-]{36}$/i.test(search.person)
        ? search.person
        : undefined,
  }),
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    const workspace = await context.queryClient.ensureQueryData(
      workspaceQueryOptions,
    )
    await Promise.all([
      workspace?.permissions.people.read
        ? context.queryClient.ensureQueryData(peopleQueryOptions)
        : Promise.resolve(),
      context.queryClient.ensureQueryData(paymentsQueryOptions()),
    ])
  },
  component: Payroll,
})

function Payroll() {
  const { view: storedView, person } = Route.useSearch()
  const view = storedView ?? 'payments'
  const navigate = useNavigate({ from: Route.fullPath })
  const [page, setPage] = useState(1)
  const workspace = useWorkspace(true)
  const people = useQuery({
    ...peopleQueryOptions,
    enabled: Boolean(workspace.data?.permissions.people.read),
  })
  const former = useQuery({
    ...formerPeopleQueryOptions,
    enabled: Boolean(workspace.data?.permissions.people.read),
  })
  const payments = useQuery(paymentsQueryOptions(page, person))
  return (
    <DashboardPage
      skeleton="table"
      wide
      title="Finance"
      description="Payments are money paid to people. Expenses are company costs, with an optional link to a person."
      actions={
        workspace.data?.permissions.payroll.write ? (
          <AddPayment
            people={people.data ?? []}
            former={former.data ?? []}
            payments={payments.data?.payments ?? []}
            disabled={!people.data?.length}
          />
        ) : undefined
      }
    >
      <Tabs
        value={view}
        onValueChange={(next) => {
          setPage(1)
          void navigate({
            search: {
              view: next === 'expenses' ? 'expenses' : 'payments',
              person,
            },
          })
        }}
      >
        <TabsList>
          <TabsTab value="payments">Payments</TabsTab>
          <TabsTab value="expenses">Expenses</TabsTab>
        </TabsList>
        <TabsPanel value="payments" className="mt-4">
          {payments.isPending ? <TableSkeleton /> : null}
          {payments.isError ? (
            <p className="py-5 text-sm text-destructive">
              {payments.error.message}
            </p>
          ) : null}
          {payments.data && !payments.data.total ? (
            <div className="rounded-xl border">
              <EmptyState
                icon={CircleDollarSign}
                title="No payments recorded yet"
                description={
                  people.data?.length
                    ? 'Use “Add payment” to create the first record.'
                    : 'Add a person to your team before recording a payment.'
                }
              >
                {!people.data?.length ? (
                  <Button
                    variant="outline"
                    render={<Link to="/dashboard/people" />}
                  >
                    Add a person first
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                ) : null}
              </EmptyState>
            </div>
          ) : null}
          {payments.data?.total ? (
            <PaymentsTable
              payments={payments.data.payments}
              page={payments.data.page}
              pageSize={payments.data.pageSize}
              total={payments.data.total}
              onPageChange={setPage}
              canDelete={Boolean(workspace.data?.permissions.payroll.write)}
            />
          ) : null}
        </TabsPanel>
        <TabsPanel value="expenses" className="mt-4">
          <ExpensesPanel
            people={people.data ?? []}
            personId={person}
            canWrite={Boolean(workspace.data?.permissions.expenses.write)}
          />
        </TabsPanel>
      </Tabs>
    </DashboardPage>
  )
}

type SortKey = 'person' | 'type' | 'period' | 'amount' | 'date'

function PaymentsTable({
  payments,
  page,
  pageSize,
  total,
  onPageChange,
  canDelete,
}: {
  payments: Payment[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  canDelete: boolean
}) {
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<Status[]>([])
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'date',
    desc: true,
  })
  const allTypes = useMemo(
    () => [...new Set(payments.map((payment) => payment.type))].sort(),
    [payments],
  )
  const allRegions = useMemo(
    () =>
      [
        ...new Set(payments.map((payment) => payment.region ?? 'No region')),
      ].sort(),
    [payments],
  )
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
      .filter(
        (payment) =>
          !term ||
          [
            personName(payment),
            payment.type,
            payment.region,
            payment.notes,
          ].some((field) => field?.toLowerCase().includes(term)),
      )
      .filter(
        (payment) =>
          (!types.length || types.includes(payment.type)) &&
          (!regions.length ||
            regions.includes(payment.region ?? 'No region')) &&
          (!statusFilter.length || statusFilter.includes(payment.status)),
      )
      .sort((a, b) => {
        const left = value(a),
          right = value(b)
        const order =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right))
        return sort.desc ? -order : order
      })
  }, [payments, search, types, regions, statusFilter, sort])
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Totals per currency for whatever is filtered, paid only.
  const totals = rows
    .filter((payment) => payment.status === 'paid')
    .reduce<Record<string, number>>(
      (sum, payment) => ({
        ...sum,
        [payment.currency]:
          (sum[payment.currency] ?? 0) + Number(payment.amount),
      }),
      {},
    )

  function toggle<T>(
    list: T[],
    set: (next: T[]) => void,
    value: T,
    checked: boolean,
  ) {
    set(checked ? [...list, value] : list.filter((item) => item !== value))
    onPageChange(1)
  }

  function header(key: SortKey, label: string, className?: string) {
    const active = sort.key === key
    return (
      <TableHead
        className={className}
        aria-sort={
          active ? (sort.desc ? 'descending' : 'ascending') : undefined
        }
      >
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-1.5 hover:text-foreground',
            className?.includes('text-right') && 'justify-end',
          )}
          onClick={() =>
            setSort({
              key,
              desc: active ? !sort.desc : key === 'amount' || key === 'date',
            })
          }
        >
          {label}
          {active &&
            (sort.desc ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            ))}
        </button>
      </TableHead>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder="Find payments on this page…"
            aria-label="Find payments"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              onPageChange(1)
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {Object.entries(totals)
              .map(([currency, amount]) =>
                paymentFormatters[currency as 'INR' | 'USD'].format(amount),
              )
              .join(' + ') || 'Nothing'}{' '}
            paid
          </p>
          <Menu>
            <MenuTrigger render={<Button variant="outline" size="sm" />}>
              <ListFilter data-icon="inline-start" />
              Filter
              {filterCount ? (
                <Badge variant="secondary" size="sm">
                  {filterCount}
                </Badge>
              ) : null}
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Type</MenuGroupLabel>
                {allTypes.map((type) => (
                  <MenuCheckboxItem
                    key={type}
                    checked={types.includes(type)}
                    onCheckedChange={(checked) =>
                      toggle(types, setTypes, type, checked)
                    }
                  >
                    {type}
                  </MenuCheckboxItem>
                ))}
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Region</MenuGroupLabel>
                {allRegions.map((region) => (
                  <MenuCheckboxItem
                    key={region}
                    checked={regions.includes(region)}
                    onCheckedChange={(checked) =>
                      toggle(regions, setRegions, region, checked)
                    }
                  >
                    {region}
                  </MenuCheckboxItem>
                ))}
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Status</MenuGroupLabel>
                {(Object.keys(statuses) as Status[]).map((status) => (
                  <MenuCheckboxItem
                    key={status}
                    checked={statusFilter.includes(status)}
                    onCheckedChange={(checked) =>
                      toggle(statusFilter, setStatusFilter, status, checked)
                    }
                  >
                    {statuses[status].label}
                  </MenuCheckboxItem>
                ))}
              </MenuGroup>
              {filterCount > 0 && (
                <>
                  <MenuSeparator />
                  <MenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => {
                      setTypes([])
                      setRegions([])
                      setStatusFilter([])
                    }}
                  >
                    Clear filters
                  </MenuCheckboxItem>
                </>
              )}
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
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link
                      to="/dashboard/people/$personId"
                      params={{ personId: payment.person_id }}
                      className="flex min-w-0 items-center gap-2.5 no-underline hover:text-primary"
                    >
                      <Avatar className="size-7">
                        {payment.avatar_url && (
                          <AvatarImage src={payment.avatar_url} alt="" />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {personName(payment)
                            .split(' ')
                            .map((part) => part.charAt(0))
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {personName(payment)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {payment.notes ?? payment.title}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{payment.type}</Badge>
                  </TableCell>
                  <TableCell>
                    {payment.region ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {payment.region}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {periodLabel(payment)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium tabular-nums',
                      payment.status === 'void' &&
                        'text-muted-foreground line-through',
                    )}
                  >
                    {paymentFormatters[payment.currency].format(
                      Number(payment.amount),
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-1.5 rounded-full',
                          statuses[payment.status].dot,
                        )}
                      />
                      {statuses[payment.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {payment.paid_on ? shortDate(payment.paid_on) : '—'}
                  </TableCell>
                  <TableCell>
                    <PaymentActions payment={payment} canDelete={canDelete} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No payments match this page.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <CardFrameFooter className="p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Showing{' '}
              <strong className="font-medium text-foreground tabular-nums">
                {payments.length
                  ? `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)}`
                  : 0}
              </strong>{' '}
              of{' '}
              <strong className="font-medium text-foreground tabular-nums">
                {total}
              </strong>
            </p>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className="sm:*:[svg]:hidden"
                    render={
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => onPageChange(page - 1)}
                      />
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    className="sm:*:[svg]:hidden"
                    render={
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= pageCount}
                        onClick={() => onPageChange(page + 1)}
                      />
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardFrameFooter>
      </CardFrame>
    </div>
  )
}

function PaymentActions({
  payment,
  canDelete,
}: {
  payment: Payment
  canDelete: boolean
}) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/payments?id=${payment.id}`, {
        method: 'DELETE',
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Could not delete payment.')
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
      ])
      appToast.success('Payment deleted')
    },
    onError: (error) =>
      appToast.error(
        'Payment not deleted',
        error,
        'Could not delete this payment.',
      ),
  })

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${personName(payment)}'s payment`}
          />
        }
      >
        <Ellipsis />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem
          disabled={!canDelete || remove.isPending}
          variant="destructive"
          onClick={() => {
            if (
              window.confirm(
                'Delete this payment record? This cannot be undone.',
              )
            )
              remove.mutate()
          }}
        >
          <Trash2 />
          Delete payment
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}

function PersonSelectValue({ person }: { person: Person }) {
  const initials = personName(person)
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="[--avatar-size:--spacing(5)]">
        <AvatarImage alt="" src={person.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{personName(person)}</span>
      <span className="truncate text-xs text-muted-foreground">
        {person.title}
      </span>
    </span>
  )
}

function AddPayment({
  people,
  former,
  payments,
  disabled,
}: {
  people: Awaited<ReturnType<typeof getPeople>>
  former: Awaited<ReturnType<typeof getPeople>>
  payments: Payment[]
  disabled: boolean
}) {
  const queryClient = useQueryClient()
  const workspace = useWorkspace(true)
  const [open, setOpen] = useState(false)
  const [employmentId, setEmploymentId] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [type, setType] = useState('Salary')
  const [newType, setNewType] = useState('')
  const [region, setRegion] = useState('')
  const [periodMonth, setPeriodMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  )
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'paid'>('paid')
  const [paidOn, setPaidOn] = useState('')
  const [notes, setNotes] = useState('')
  const id = useId()
  const typeOptions = [
    ...new Set([...DEFAULT_TYPES, ...payments.map((payment) => payment.type)]),
  ]
  const regionOptions = [
    ...new Set(
      payments
        .map((payment) => payment.region)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employmentId,
          amount: amount.replaceAll(',', ''),
          currency,
          status,
          paidOn,
          notes,
          type: type === '__new' ? newType : type,
          region,
          periodMonth,
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Could not record payment.')
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
      ])
      setOpen(false)
      setEmploymentId('')
      setSelectedPerson(null)
      setAmount('')
      setNotes('')
      setNewType('')
      appToast.success(
        status === 'paid' ? 'Payment recorded as paid' : 'Payment recorded',
      )
    },
    onError: (error) =>
      appToast.error(
        'Payment not recorded',
        error,
        'Could not record payment.',
      ),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setCurrency(workspace.data?.default_currency ?? 'INR')
      }}
    >
      <DialogTrigger render={<Button disabled={disabled} />}>
        <Plus data-icon="inline-start" />
        Add payment
      </DialogTrigger>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Add payment</DialogTitle>
          <DialogDescription>
            Record an amount for a person. This does not transfer funds.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Person
              <Select
                value={selectedPerson}
                itemToStringValue={(person) => person.employment_id}
                onValueChange={(person) => {
                  setSelectedPerson(person ?? null)
                  setEmploymentId(person?.employment_id ?? '')
                }}
              >
                <SelectTrigger aria-label="Select a person">
                  <SelectValue placeholder="Choose a person">
                    {(person) =>
                      person ? <PersonSelectValue person={person} /> : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectGroup>
                    <SelectGroupLabel>Active people</SelectGroupLabel>
                    {people.map((person) => (
                      <SelectItem key={person.employment_id} value={person}>
                        <PersonSelectValue person={person} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {former.length > 0 ? (
                    <SelectGroup>
                      <SelectGroupLabel>
                        Former people — final settlement
                      </SelectGroupLabel>
                      {former.map((person) => (
                        <SelectItem key={person.employment_id} value={person}>
                          <PersonSelectValue person={person} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectPopup>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Payment type
              <Select
                value={type}
                onValueChange={(value) => setType(value ?? 'Salary')}
              >
                <SelectTrigger aria-label="Select payment type">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {typeOptions.map((option) => {
                    const Icon =
                      paymentTypeOptions.find((item) => item.value === option)
                        ?.icon ?? ReceiptText
                    return (
                      <SelectItem key={option} value={option}>
                        <span className="flex items-center gap-2">
                          <Icon />
                          <span>{option}</span>
                        </span>
                      </SelectItem>
                    )
                  })}
                  <SelectItem value="__new">
                    <span className="flex items-center gap-2">
                      <Plus />
                      <span>New type…</span>
                    </span>
                  </SelectItem>
                </SelectPopup>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Region
              <Input
                list={`${id}-regions`}
                value={region}
                placeholder="e.g. Bengaluru"
                onChange={(event) => setRegion(event.target.value)}
              />
              <datalist id={`${id}-regions`}>
                {regionOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            {type === '__new' && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                New type name
                <Input
                  required
                  autoFocus
                  value={newType}
                  placeholder="e.g. Joining bonus"
                  maxLength={40}
                  onChange={(event) => setNewType(event.target.value)}
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Amount
              <Group className="w-full">
                <Select
                  value={currency}
                  onValueChange={(value) =>
                    setCurrency(value === 'USD' ? 'USD' : 'INR')
                  }
                >
                  <SelectTrigger
                    aria-label="Currency"
                    className="w-24 min-w-24"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectPopup>
                </Select>
                <GroupSeparator />
                <Input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) =>
                    setAmount(formatAmountInput(event.target.value))
                  }
                  placeholder="0.00"
                  aria-label="Amount"
                />
              </Group>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              For month
              <Input
                type="month"
                value={periodMonth}
                onChange={(event) => setPeriodMonth(event.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Status
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(
                      value === 'scheduled' || value === 'draft'
                        ? value
                        : 'paid',
                    )
                  }
                >
                  <SelectTrigger aria-label="Payment status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectPopup>
                </Select>
              </label>
              {status === 'paid' && (
                <div className="flex flex-col gap-1.5 text-sm font-medium">
                  Paid on
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                        />
                      }
                    >
                      <CalendarDays data-icon="inline-start" />
                      {paidOn || 'Choose date'}
                    </PopoverTrigger>
                    <PopoverPopup>
                      <Calendar
                        mode="single"
                        selected={
                          paidOn ? new Date(`${paidOn}T12:00:00`) : undefined
                        }
                        onSelect={(date) => {
                          if (date) setPaidOn(localDateString(date))
                        }}
                      />
                    </PopoverPopup>
                  </Popover>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${id}-note`}>Note</Label>
                <span className="text-sm text-muted-foreground">Optional</span>
              </div>
              <Textarea
                id={`${id}-note`}
                placeholder="e.g. October salary, 2 unpaid days deducted"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            {create.isError ? (
              <p className="text-sm text-destructive">{create.error.message}</p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" loading={create.isPending}>
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

type Expense = {
  id: string
  label: string
  amount: string
  currency: 'INR' | 'USD'
  incurred_on: string
  notes: string | null
  person_id: string | null
  first_name: string | null
  last_name: string | null
  nickname: string | null
}

function ExpensesPanel({
  people,
  personId,
  canWrite,
}: {
  people: Person[]
  personId?: string
  canWrite: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [incurredOn, setIncurredOn] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [employmentId, setEmploymentId] = useState('')
  const [notes, setNotes] = useState('')
  const expenses = useQuery({
    queryKey: ['expenses', personId ?? 'all'],
    queryFn: async () => {
      const response = await fetch(
        `/api/expenses${personId ? `?person=${personId}` : ''}`,
      )
      const payload = (await response.json()) as {
        expenses?: Expense[]
        error?: string
      }
      if (!response.ok)
        throw new Error(payload.error ?? 'Could not load expenses.')
      return payload.expenses ?? []
    },
  })
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          amount: amount.replaceAll(',', ''),
          currency,
          incurredOn,
          employmentId: employmentId || null,
          notes,
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Could not save expense.')
    },
    onSuccess: async () => {
      setOpen(false)
      setLabel('')
      setAmount('')
      setNotes('')
      setEmploymentId('')
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      appToast.success('Expense saved')
    },
    onError: (error) =>
      appToast.error(
        'Expense not saved',
        error,
        'Could not save this expense.',
      ),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: 'DELETE',
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? 'Could not delete expense.')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      appToast.success('Expense deleted')
    },
  })
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Record food, software, day passes, or other company costs. A person is
          optional.
        </p>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <Plus data-icon="inline-start" />
              Add expense
            </DialogTrigger>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>Add company expense</DialogTitle>
                <DialogDescription>
                  Keep this separate from pay. Link a person only when the cost
                  belongs to them.
                </DialogDescription>
              </DialogHeader>
              <form
                className="contents"
                onSubmit={(event) => {
                  event.preventDefault()
                  create.mutate()
                }}
              >
                <DialogPanel className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    What was it?
                    <Input
                      required
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="e.g. Figma subscription, food, day pass"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Linked person{' '}
                    <Select
                      value={employmentId}
                      onValueChange={(value) => setEmploymentId(value ?? '')}
                    >
                      <SelectTrigger aria-label="Linked person">
                        <SelectValue placeholder="No one — company expense" />
                      </SelectTrigger>
                      <SelectPopup>
                        <SelectItem value="">
                          No one — company expense
                        </SelectItem>
                        {people.map((person) => (
                          <SelectItem
                            key={person.employment_id}
                            value={person.employment_id}
                          >
                            <PersonSelectValue person={person} />
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Amount
                    <Group>
                      <Select
                        value={currency}
                        onValueChange={(value) =>
                          setCurrency(value === 'USD' ? 'USD' : 'INR')
                        }
                      >
                        <SelectTrigger
                          className="w-24 min-w-24"
                          aria-label="Currency"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectPopup>
                      </Select>
                      <GroupSeparator />
                      <Input
                        required
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) =>
                          setAmount(formatAmountInput(event.target.value))
                        }
                        placeholder="0.00"
                      />
                    </Group>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Date
                    <Input
                      required
                      type="date"
                      value={incurredOn}
                      onChange={(event) => setIncurredOn(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Note{' '}
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                  {create.isError && (
                    <p className="text-sm text-destructive">
                      {create.error.message}
                    </p>
                  )}
                </DialogPanel>
                <DialogFooter>
                  <DialogClose render={<Button variant="ghost" />}>
                    Cancel
                  </DialogClose>
                  <Button type="submit" loading={create.isPending}>
                    Save expense
                  </Button>
                </DialogFooter>
              </form>
            </DialogPopup>
          </Dialog>
        )}
      </div>
      {expenses.isPending ? (
        <TableSkeleton rows={3} />
      ) : expenses.isError ? (
        <p className="text-sm text-destructive">{expenses.error.message}</p>
      ) : (
        <CardFrame>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Expense</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.data?.length ? (
                expenses.data.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <span className="font-medium">{expense.label}</span>
                      {expense.notes && (
                        <span className="block text-xs text-muted-foreground">
                          {expense.notes}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {expense.person_id ? (
                        <Link
                          to="/dashboard/people/$personId"
                          params={{ personId: expense.person_id }}
                          className="hover:text-primary"
                        >
                          {expense.nickname ||
                            `${expense.first_name ?? ''} ${expense.last_name ?? ''}`.trim()}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Company</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {shortDate(expense.incurred_on)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {paymentFormatters[expense.currency].format(
                        Number(expense.amount),
                      )}
                    </TableCell>
                    <TableCell>
                      {canWrite && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete expense"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm('Delete this expense?'))
                              remove.mutate(expense.id)
                          }}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No expenses recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardFrame>
      )}
    </div>
  )
}
