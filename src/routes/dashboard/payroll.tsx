import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { ArrowRight, CalendarDays, Plus } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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
import { Input } from '#/components/ui/input'
import { peopleQueryOptions, personName } from '#/lib/people-client'
import type { getPeople } from '#/lib/people-client'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Calendar } from '#/components/ui/calendar'
import { Popover, PopoverPopup, PopoverTrigger } from '#/components/ui/popover'
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

type Payment = {
  id: string
  amount: string
  currency: 'INR' | 'USD'
  status: 'draft' | 'paid' | 'scheduled' | 'void'
  paid_on: string | null
  created_at: string
  person_id: string
  first_name: string
  last_name: string | null
  title: string
}


const items = [
  { color: 'bg-muted-foreground', label: 'Draft', value: 'draft' },
  { color: 'bg-primary', label: 'Paid', value: 'paid' },
] as { color: string; label: string; value: 'draft' | 'paid' }[]

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
  INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
  USD: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'USD' }),
}

async function getPayments() {
  const response = await fetch('/api/payments')
  const payload = (await response.json()) as {
    payments?: Payment[]
    error?: string
  }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load payments.')
  return payload.payments ?? []
}

const paymentsQueryOptions = {
  queryKey: ['payments'] as const,
  queryFn: getPayments,
  staleTime: 60_000,
}

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
  return (
    <DashboardPage
      title="Payments"
      description="A straightforward record of what you have paid, and what is still a draft."
    >
      <PaymentsContent />
    </DashboardPage>
  )
}

function PaymentsContent() {
  const payments = useQuery(paymentsQueryOptions)
  const workspace = useWorkspace(true)
  const people = useQuery({ ...peopleQueryOptions, enabled: Boolean(workspace.data?.permissions.people.read) })
  return (
    <>
      <div className="mb-5 flex justify-end">
        {workspace.data?.permissions.payroll.write && <AddPayment
          people={people.data ?? []}
          disabled={!people.data?.length}
        />}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
          <CardDescription>
            Amounts are stored in the currency you record, with no conversion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.isPending ? (
            <p className="py-5 text-sm text-muted-foreground">
              Loading payments…
            </p>
          ) : null}
          {payments.isError ? (
            <p className="py-5 text-sm text-destructive">
              {payments.error.message}
            </p>
          ) : null}
          {payments.data && !payments.data.length ? (
            <div className="py-6">
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
              {!people.data?.length ? (
                <Button
                  className="mt-4"
                  variant="outline"
                  render={<Link to="/dashboard/people" />}
                >
                  Add a person first
                  <ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Use “Add payment” to create the first record.
                </p>
              )}
            </div>
          ) : null}
          {payments.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Person</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="py-3">
                        <Link
                          to="/dashboard/people/$personId"
                          params={{ personId: payment.person_id }}
                          className="font-medium no-underline hover:text-primary"
                        >
                          {personName(payment)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {payment.title}
                        </span>
                      </td>
                      <td className="py-3 tabular-nums">
                        {paymentFormatters[payment.currency].format(
                          Number(payment.amount),
                        )}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground capitalize">
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {(payment.paid_on ?? payment.created_at).slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}

function AddPayment({
  people,
  disabled,
}: {
  people: Awaited<ReturnType<typeof getPeople>>
  disabled: boolean
}) {
  const queryClient = useQueryClient()
  const workspace = useWorkspace(true)
  const [open, setOpen] = useState(false)
  const [employmentId, setEmploymentId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [status, setStatus] = useState<'draft' | 'paid'>('draft')
  const [paidOn, setPaidOn] = useState('')
  const [notes, setNotes] = useState('')
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
      setAmount('')
      setStatus('draft')
      setPaidOn('')
      setNotes('')
    },
  })
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate()
  }
  const id = useId()

  function openChange(next: boolean) {
    setOpen(next)
    if (next) setCurrency(workspace.data?.default_currency ?? 'INR')
  }
  return (
    <Dialog open={open} onOpenChange={openChange}>
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
        <form onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Person
              <Select
                items={people.map((person) => ({ label: personName(person), value: person.employment_id }))}
                value={people.map((person) => ({ label: personName(person), value: person.employment_id })).find((item) => item.value === employmentId)}
                onValueChange={(item) => setEmploymentId(item?.value ?? '')}
                itemToStringValue={(item) => item.label}
              >
                <SelectTrigger aria-label="Select a person"><SelectValue placeholder="Select a person" /></SelectTrigger>
                <SelectPopup>{people.map((person) => { const item = { label: personName(person), value: person.employment_id }; return <SelectItem key={item.value} value={item}>{item.label}</SelectItem> })}</SelectPopup>
              </Select>
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Amount
                <Input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(formatAmountInput(event.target.value))}
                  placeholder="0.00"
                  aria-describedby={`${id}-amount-hint`}
                />
                <span id={`${id}-amount-hint`} className="text-xs font-normal text-muted-foreground">Use up to two decimal places.</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Currency
                <Select items={[{ label: 'INR', value: 'INR' }, { label: 'USD', value: 'USD' }]} value={{ label: currency, value: currency }} onValueChange={(item) => { if (item) setCurrency(item.value) }} itemToStringValue={(item) => item.label}>
                  <SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger>
                  <SelectPopup><SelectItem value={{ label: 'INR', value: 'INR' }}>INR</SelectItem><SelectItem value={{ label: 'USD', value: 'USD' }}>USD</SelectItem></SelectPopup>
                </Select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Status
              <Select
                value={items.find((item) => item.value === status)}
                itemToStringValue={(item) => item.value}
                onValueChange={(item) => { if (item) setStatus(item.value) }}
              >
                <SelectTrigger aria-label="Select status">
                  <SelectValue>
                    {(item) => (
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ${item.color}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ${item.color}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </label>
            {status === 'paid' ? (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Paid on
                <Popover><PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-start" />}><CalendarDays data-icon="inline-start" />{paidOn || 'Choose date'}</PopoverTrigger><PopoverPopup><Calendar mode="single" selected={paidOn ? new Date(`${paidOn}T12:00:00`) : undefined} onSelect={(date) => { if (date) setPaidOn(localDateString(date)) }} /></PopoverPopup></Popover>
              </label>
            ) : null}
            <div className="flex flex-col gap-2">
              <div className="inline-flex w-full items-center justify-between gap-2">
                <Label htmlFor={id}>Note</Label>
                <Label
                  className="font-normal text-muted-foreground"
                  render={<span />}
                >
                  Optional
                </Label>
              </div>
              <Textarea
                id={id}
                placeholder="Type your message here"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            {create.isError ? (
              <p className="text-sm text-destructive">{create.error.message}</p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
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
