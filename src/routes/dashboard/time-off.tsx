import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  FileText,
  Inbox,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react'
import { EmptyState } from '#/components/empty-state'
import { DashboardPage } from '#/components/dashboard-page'
import { CalendarSkeleton } from '#/components/page-skeletons'
import {
  TimeOffCalendar,
  categoryOf,
  categoryStyles,
  formatDay,
  formatRange,
  holidayStyle,
} from '#/components/time-off-calendar'
import type {
  CalendarHoliday,
  LeaveCategory,
} from '#/components/time-off-calendar'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '#/components/ui/dialog'
import { Group, GroupSeparator } from '#/components/ui/group'
import { Input } from '#/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '#/components/ui/menu'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTab } from '#/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { cn } from '#/lib/utils'
import { appToast } from '#/lib/toast'
import { useWorkspace } from '#/lib/workspace-client'

type Policy = {
  id: string
  name: string
  category: string
  annual_allowance: string
  accrues: boolean
  carry_forward_limit: string
  allow_half_days: boolean
}
type Leave = {
  id: string
  employment_id: string
  leave_policy_id: string
  start_date: string
  end_date: string
  duration_days: string
  reason: string | null
  status: string
  entry_type: string
  first_name: string
  last_name: string | null
  avatar_url: string | null
  policy_name: string
  policy_category: string
  created_by_name: string | null
  created_by_role: string | null
}
type Person = {
  employment_id: string
  first_name: string
  last_name: string | null
  title: string
  avatar_url: string | null
}
type Data = {
  policies: Policy[]
  holidays: CalendarHoliday[]
  requests: Leave[]
  people: Person[]
  today: string
  workingDays: number[]
  balances: {
    employment_id: string
    policy_id: string
    earned: number
    carried: number
    used: number
    available: number
  }[]
}

async function getTimeOff() {
  const response = await fetch('/api/time-off')
  const data = (await response.json()) as Data & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Could not load time off.')
  return data
}

export const timeOffQueryOptions = {
  queryKey: ['time-off'] as const,
  queryFn: getTimeOff,
  staleTime: 30_000,
}

export const Route = createFileRoute('/dashboard/time-off')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    void context.queryClient.prefetchQuery(timeOffQueryOptions)
  },
  component: TimeOffPage,
})

type DialogState =
  | { type: 'leave'; mode: 'request' | 'recorded' }
  | { type: 'holiday'; holiday?: CalendarHoliday }
  | { type: 'policy'; policy?: Policy }
  | null

function TimeOffPage() {
  const query = useQuery(timeOffQueryOptions)
  const workspace = useWorkspace(true)
  const canWrite = workspace.data?.permissions.calendar.write ?? false
  const [dialog, setDialog] = useState<DialogState>(null)
  const data = query.data
  const canAddLeave = Boolean(data?.people.length && data.policies.length)

  return (
    <DashboardPage
      title="Calendar"
      // description="Holidays, leave and who is working from home."
      skeleton="calendar"
      wide
      actions={
        data && canWrite ? (
          <Group aria-label="Calendar actions">
            <Button
              disabled={!canAddLeave}
              onClick={() => setDialog({ type: 'leave', mode: 'recorded' })}
            >
              <Plus data-icon="inline-start" />
              Record taken leave
            </Button>
            <GroupSeparator className="bg-primary/72" />
            <Menu>
              <MenuTrigger
                render={
                  <Button size="icon" aria-label="More calendar actions" />
                }
              >
                <ChevronDown aria-hidden="true" className="size-4" />
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuItem
                  disabled={!canAddLeave}
                  onClick={() => setDialog({ type: 'leave', mode: 'request' })}
                >
                  <Inbox aria-hidden="true" />
                  Leave request
                </MenuItem>
                <MenuItem onClick={() => setDialog({ type: 'holiday' })}>
                  <CalendarPlus aria-hidden="true" />
                  Holiday
                </MenuItem>
                <MenuItem onClick={() => setDialog({ type: 'policy' })}>
                  <ScrollText aria-hidden="true" />
                  Leave type
                </MenuItem>
              </MenuPopup>
            </Menu>
          </Group>
        ) : undefined
      }
    >
      {query.isPending && <CalendarSkeleton />}
      {query.isError && (
        <p className="text-sm text-destructive">{query.error.message}</p>
      )}
      {data && (
        <>
          <TodayStrip data={data} />
          <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <TimeOffCalendar
                holidays={data.holidays}
                requests={data.requests}
                today={data.today}
                workingDays={data.workingDays}
                onHolidayClick={
                  canWrite
                    ? (holiday) => setDialog({ type: 'holiday', holiday })
                    : undefined
                }
              />
            </div>
            <div className="flex flex-col gap-5">
              <PolicyCard
                data={data}
                canWrite={canWrite}
                onEdit={(policy) => setDialog({ type: 'policy', policy })}
              />
              <HolidayCard
                data={data}
                canWrite={canWrite}
                onEdit={(holiday) => setDialog({ type: 'holiday', holiday })}
              />
            </div>
          </div>
          <LeaveTable data={data} canWrite={canWrite} />
          <BalanceTable data={data} />
          {dialog?.type === 'leave' && (
            <LeaveDialog
              data={data}
              mode={dialog.mode}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.type === 'holiday' && (
            <HolidayDialog
              holiday={dialog.holiday}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.type === 'policy' && (
            <PolicyDialog
              policy={dialog.policy}
              onClose={() => setDialog(null)}
            />
          )}
        </>
      )}
    </DashboardPage>
  )
}

function useTimeOffAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: object) => {
      const response = await fetch('/api/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Could not save.')
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['time-off'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

function initials(first: string, last: string | null) {
  return `${first.charAt(0)}${last?.charAt(0) ?? ''}`.toUpperCase() || '?'
}

function PersonCell({
  first,
  last,
  avatar,
  detail,
}: {
  first: string
  last: string | null
  avatar: string | null
  detail?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-7">
        {avatar && <AvatarImage src={avatar} alt="" />}
        <AvatarFallback className="text-[10px]">
          {initials(first, last)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">
          {first} {last ?? ''}
        </p>
        {detail && (
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        )}
      </div>
    </div>
  )
}

function CategoryBadge({ category, name }: { category: string; name: string }) {
  const style = categoryStyles[categoryOf(category)]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        style.chip,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} />
      {name}
    </span>
  )
}

/** Who is away or remote today, and the next holiday, in one line. */
function TodayStrip({ data }: { data: Data }) {
  const active = data.requests.filter(
    (leave) =>
      (leave.status === 'approved' || leave.status === 'pending') &&
      leave.start_date <= data.today &&
      leave.end_date >= data.today,
  )
  const away = active.filter(
    (leave) => categoryOf(leave.policy_category) !== 'wfh',
  )
  const remote = active.filter(
    (leave) => categoryOf(leave.policy_category) === 'wfh',
  )
  const nextHoliday = data.holidays.find(
    (holiday) => holiday.date >= data.today,
  )
  const todayIsOff = !data.workingDays.includes(
    new Date(`${data.today}T00:00:00Z`).getUTCDay(),
  )
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <StripItem
        label="Away today"
        empty={todayIsOff ? 'Weekly off today' : 'Everyone is in'}
      >
        {away.map((leave) => (
          <span key={leave.id} className="flex items-center gap-2">
            <span className="truncate">
              {leave.first_name} {leave.last_name ?? ''}
            </span>
            <CategoryBadge
              category={leave.policy_category}
              name={`until ${formatDay(leave.end_date)}`}
            />
          </span>
        ))}
      </StripItem>
      <StripItem label="Working from home" empty="Nobody today">
        {remote.map((leave) => (
          <span key={leave.id} className="truncate">
            {leave.first_name} {leave.last_name ?? ''}
          </span>
        ))}
      </StripItem>
      <StripItem label="Next holiday" empty="None scheduled">
        {nextHoliday && (
          <span className="flex items-center gap-2">
            <span className="truncate">{nextHoliday.name}</span>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium',
                holidayStyle.chip,
              )}
            >
              {formatDay(nextHoliday.date)}
            </span>
          </span>
        )}
      </StripItem>
    </div>
  )
}

function StripItem({
  label,
  empty,
  children,
}: {
  label: string
  empty: string
  children: React.ReactNode
}) {
  const items = (Array.isArray(children) ? children : [children]).filter(
    Boolean,
  )
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex flex-col gap-1 text-sm">
        {items.length ? (
          items
        ) : (
          <span className="text-muted-foreground">{empty}</span>
        )}
      </div>
    </div>
  )
}

function describePolicy(policy: Policy) {
  const category = categoryOf(policy.category)
  if (category === 'wfh') return 'Working remotely. Not counted as time off.'
  if (category === 'unpaid') return 'No balance. Each day is unpaid.'
  const annual = Number(policy.annual_allowance)
  const perMonth = Math.round((annual / 12) * 100) / 100
  const earn = policy.accrues
    ? `${perMonth} ${perMonth === 1 ? 'day' : 'days'} earned each month (${annual} a year)`
    : `${annual} days available from the start of the year`
  const carry =
    Number(policy.carry_forward_limit) > 0
      ? `, up to ${Number(policy.carry_forward_limit)} carried into next year`
      : ', unused days reset each year'
  return `${earn}${carry}.${policy.allow_half_days ? ' Half-days allowed.' : ''}`
}

function PolicyCard({
  data,
  canWrite,
  onEdit,
}: {
  data: Data
  canWrite: boolean
  onEdit: (policy: Policy) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave types</CardTitle>
        <CardDescription>How time away is counted.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.policies.length ? (
          <div className="flex flex-col divide-y">
            {data.policies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-start gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    categoryStyles[categoryOf(policy.category)].dot,
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{policy.name}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {describePolicy(policy)}
                  </p>
                </div>
                {canWrite && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Edit ${policy.name}`}
                    onClick={() => onEdit(policy)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No leave types"
            description="Add a leave type to start recording leave."
          />
        )}
      </CardContent>
    </Card>
  )
}

function HolidayCard({
  data,
  canWrite,
  onEdit,
}: {
  data: Data
  canWrite: boolean
  onEdit: (holiday: CalendarHoliday) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const year = data.today.slice(0, 4)
  const list = showAll
    ? data.holidays.filter((holiday) => holiday.date.startsWith(year))
    : data.holidays.filter((holiday) => holiday.date >= data.today).slice(0, 6)
  const remove = useTimeOffAction()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {showAll ? `Holidays in ${year}` : 'Upcoming holidays'}
        </CardTitle>
        <CardDescription>
          {
            data.holidays.filter((holiday) => holiday.date.startsWith(year))
              .length
          }{' '}
          holidays this year.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length ? (
          <div className="flex flex-col">
            {list.map((holiday) => (
              <div
                key={holiday.id}
                className="group flex items-center gap-2 py-1.5 text-sm"
              >
                <span
                  className={cn(
                    'w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-medium tabular-nums',
                    holidayStyle.chip,
                    holiday.date < data.today && 'opacity-60',
                  )}
                >
                  {formatDay(holiday.date)}
                </span>
                <span className="min-w-0 flex-1 truncate">{holiday.name}</span>
                {holiday.kind === 'public' && (
                  <Badge variant="outline" size="sm">
                    Public
                  </Badge>
                )}
                {canWrite && (
                  <>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Edit ${holiday.name}`}
                      onClick={() => onEdit(holiday)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Delete ${holiday.name}`}
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate({
                          action: 'removeHoliday',
                          holidayId: holiday.id,
                        }, { onSuccess: () => appToast.info('Holiday removed') })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No holidays yet"
            description="Company and public holidays you add show up here."
          />
        )}
        {data.holidays.length > 0 && (
          <Button
            variant="link"
            size="sm"
            className="mt-2 px-0"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show upcoming only' : 'Show the whole year'}
          </Button>
        )}
        {remove.isError && (
          <p className="text-xs text-destructive">{remove.error.message}</p>
        )}
      </CardContent>
    </Card>
  )
}

function statusBadge(leave: Leave) {
  if (leave.status === 'pending')
    return <Badge variant="warning">Awaiting approval</Badge>
  if (leave.status === 'approved')
    return (
      <Badge variant="success">
        {leave.entry_type === 'recorded' ? 'Recorded' : 'Approved'}
      </Badge>
    )
  return (
    <Badge variant="secondary" className="capitalize">
      {leave.status}
    </Badge>
  )
}

function LeaveTable({ data, canWrite }: { data: Data; canWrite: boolean }) {
  const [tab, setTab] = useState<'upcoming' | 'past' | 'pending' | 'all'>(
    'upcoming',
  )
  const review = useTimeOffAction()
  const rows = useMemo(() => {
    const list = data.requests.filter((leave) => {
      if (tab === 'pending') return leave.status === 'pending'
      if (tab === 'upcoming')
        return (
          leave.end_date >= data.today &&
          (leave.status === 'approved' || leave.status === 'pending')
        )
      if (tab === 'past') return leave.end_date < data.today
      return true
    })
    return tab === 'upcoming' || tab === 'pending'
      ? [...list].sort((a, b) => a.start_date.localeCompare(b.start_date))
      : list
  }, [data, tab])
  const pendingCount = data.requests.filter(
    (leave) => leave.status === 'pending',
  ).length
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Leave</h2>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as typeof tab)}
        >
          <TabsList>
            <TabsTab value="upcoming">Current & upcoming</TabsTab>
            <TabsTab value="pending">
              To review
              {pendingCount ? (
                <Badge variant="warning" size="sm">
                  {pendingCount}
                </Badge>
              ) : null}
            </TabsTab>
            <TabsTab value="past">Past</TabsTab>
            <TabsTab value="all">All</TabsTab>
          </TabsList>
        </Tabs>
      </div>
      {rows.length ? (
        <Table variant="card">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Person</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Working days</TableHead>
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="w-px" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((leave) => (
              <TableRow key={leave.id}>
                <TableCell>
                  <PersonCell
                    first={leave.first_name}
                    last={leave.last_name}
                    avatar={leave.avatar_url}
                    detail={leave.reason ?? undefined}
                  />
                </TableCell>
                <TableCell>
                  <CategoryBadge
                    category={leave.policy_category}
                    name={leave.policy_name}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatRange(leave.start_date, leave.end_date)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(leave.duration_days)}
                </TableCell>
                <TableCell>{statusBadge(leave)}</TableCell>
                {canWrite && (
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {leave.status === 'pending' && (
                        <>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={review.isPending}
                            onClick={() =>
                              review.mutate({
                                action: 'review',
                                requestId: leave.id,
                                decision: 'declined',
                              })
                            }
                          >
                            Decline
                          </Button>
                          <Button
                            size="xs"
                            disabled={review.isPending}
                            onClick={() =>
                              review.mutate({
                                action: 'review',
                                requestId: leave.id,
                                decision: 'approved',
                              })
                            }
                          >
                            Approve
                          </Button>
                        </>
                      )}
                      {(leave.status === 'pending' ||
                        leave.status === 'approved') && (
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate({
                              action: 'cancel',
                              requestId: leave.id,
                            })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-xl border">
          <EmptyState
            icon={Inbox}
            title="Nothing here"
            description={
              tab === 'pending'
                ? 'No leave is waiting for approval.'
                : 'No leave in this view.'
            }
          />
        </div>
      )}
      {review.isError && (
        <p className="mt-2 text-sm text-destructive">{review.error.message}</p>
      )}
    </section>
  )
}

function BalanceTable({ data }: { data: Data }) {
  const paid = data.policies.filter(
    (policy) => categoryOf(policy.category) === 'paid',
  )
  if (!data.balances.length || !paid.length) return null
  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Leave balances</h2>
        <p className="text-sm text-muted-foreground">
          Days left this year: earned so far plus carried over, minus used.
        </p>
      </div>
      <Table variant="card">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Person</TableHead>
            {paid.map((policy) => (
              <TableHead key={policy.id} className="text-right">
                {policy.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.people.map((person) => (
            <TableRow key={person.employment_id}>
              <TableCell>
                <PersonCell
                  first={person.first_name}
                  last={person.last_name}
                  avatar={person.avatar_url}
                  detail={person.title}
                />
              </TableCell>
              {paid.map((policy) => {
                const balance = data.balances.find(
                  (item) =>
                    item.employment_id === person.employment_id &&
                    item.policy_id === policy.id,
                )
                if (!balance) return <TableCell key={policy.id} />
                return (
                  <TableCell key={policy.id} className="text-right">
                    <span
                      className={cn(
                        'block font-medium tabular-nums',
                        balance.available < 0 && 'text-destructive',
                      )}
                    >
                      {balance.available} left
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {balance.used} used of{' '}
                      {Math.round((balance.earned + balance.carried) * 10) / 10}
                    </span>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function LeaveDialog({
  data,
  mode,
  onClose,
}: {
  data: Data
  mode: 'request' | 'recorded'
  onClose: () => void
}) {
  const [employmentId, setEmploymentId] = useState('')
  const [policyId, setPolicyId] = useState(data.policies[0]?.id ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [reason, setReason] = useState('')
  const action = useTimeOffAction()
  const recorded = mode === 'recorded'
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {recorded ? 'Record leave already taken' : 'Add a leave request'}
          </DialogTitle>
          <DialogDescription>
            {recorded
              ? 'For days that have already happened. It is saved as approved.'
              : 'For upcoming days. It stays pending until someone approves it.'}{' '}
            Weekly offs and holidays are not counted.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            action.mutate(
              {
                action: recorded ? 'recordLeave' : 'request',
                employmentId,
                policyId,
                startDate,
                endDate: endDate || startDate,
                halfDay,
                reason,
              },
              { onSuccess: () => { appToast.success(recorded ? 'Leave recorded' : 'Leave request added'); onClose() }, onError: (error) => appToast.error('Leave not saved', error, 'Could not save leave.') },
            )
          }}
        >
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Person
              <NativeSelect
                required
                value={employmentId}
                onChange={(event) => setEmploymentId(event.target.value)}
              >
                <NativeSelectOption value="">
                  Choose a person
                </NativeSelectOption>
                {data.people.map((person) => (
                  <NativeSelectOption
                    key={person.employment_id}
                    value={person.employment_id}
                  >
                    {person.first_name} {person.last_name ?? ''}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Type
              <NativeSelect
                required
                value={policyId}
                onChange={(event) => setPolicyId(event.target.value)}
              >
                {data.policies.map((policy) => (
                  <NativeSelectOption key={policy.id} value={policy.id}>
                    {policy.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                From
                <Input
                  required
                  type="date"
                  max={recorded ? data.today : undefined}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                To
                <Input
                  type="date"
                  min={startDate || undefined}
                  max={recorded ? data.today : undefined}
                  value={endDate}
                  placeholder="Same day"
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={halfDay}
                onCheckedChange={(value) => setHalfDay(value === true)}
              />
              Half-day
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Reason <span className="sr-only">(optional)</span>
              <Input
                value={reason}
                placeholder="Optional"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {action.isError && (
              <p className="text-sm text-destructive">{action.error.message}</p>
            )}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" loading={action.isPending}>
              {recorded ? 'Record leave' : 'Add request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

function HolidayDialog({
  holiday,
  onClose,
}: {
  holiday?: CalendarHoliday
  onClose: () => void
}) {
  const [name, setName] = useState(holiday?.name ?? '')
  const [date, setDate] = useState(holiday?.date ?? '')
  const [kind, setKind] = useState(holiday?.kind ?? 'company')
  const action = useTimeOffAction()
  const remove = useTimeOffAction()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{holiday ? 'Edit holiday' : 'Add holiday'}</DialogTitle>
          <DialogDescription>
            Everyone has the day off. Leave on this day is not counted.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            action.mutate(
              holiday
                ? {
                    action: 'updateHoliday',
                    holidayId: holiday.id,
                    name,
                    date,
                    kind,
                  }
                : { action: 'holiday', name, date, kind },
              { onSuccess: () => { appToast.success(holiday ? 'Holiday updated' : 'Holiday added'); onClose() }, onError: (error) => appToast.error('Holiday not saved', error, 'Could not save holiday.') },
            )
          }}
        >
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Name
              <Input
                required
                value={name}
                placeholder="Diwali"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Date
              <Input
                required
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              Kind
              <ToggleGroup
                variant="outline"
                value={[kind]}
                onValueChange={(value) => {
                  if (value[0]) setKind(value[0])
                }}
                aria-label="Holiday kind"
              >
                <ToggleGroupItem value="public" className="px-3">
                  Public holiday
                </ToggleGroupItem>
                <ToggleGroupItem value="company" className="px-3">
                  Company holiday
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {(action.isError || remove.isError) && (
              <p className="text-sm text-destructive">
                {(action.error ?? remove.error)?.message}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            {holiday && (
              <Button
                type="button"
                variant="destructive-outline"
                className="sm:mr-auto"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { action: 'removeHoliday', holidayId: holiday.id },
                    { onSuccess: () => { appToast.info('Holiday removed'); onClose() }, onError: (error) => appToast.error('Holiday not removed', error, 'Could not remove holiday.') },
                  )
                }
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            )}
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" loading={action.isPending}>
              {holiday ? 'Save' : 'Add holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

function PolicyDialog({
  policy,
  onClose,
}: {
  policy?: Policy
  onClose: () => void
}) {
  const [name, setName] = useState(policy?.name ?? '')
  const [category, setCategory] = useState<LeaveCategory>(
    policy ? categoryOf(policy.category) : 'paid',
  )
  const [perMonth, setPerMonth] = useState(
    policy
      ? String(Math.round((Number(policy.annual_allowance) / 12) * 100) / 100)
      : '1',
  )
  const [accrues, setAccrues] = useState(policy?.accrues ?? true)
  const [carry, setCarry] = useState(
    policy ? String(Number(policy.carry_forward_limit)) : '0',
  )
  const [half, setHalf] = useState(policy?.allow_half_days ?? true)
  const action = useTimeOffAction()
  const remove = useTimeOffAction()
  const annual = Math.round(Number(perMonth || 0) * 12 * 10) / 10
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {policy ? 'Edit leave type' : 'Add leave type'}
          </DialogTitle>
          <DialogDescription>
            Paid leave builds up a balance. Unpaid leave and work from home are
            just recorded.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            const body = {
              name,
              category,
              annualAllowance: annual,
              accrues,
              carryForwardLimit: Number(carry || 0),
              allowHalfDays: half,
            }
            action.mutate(
              policy
                ? { action: 'updatePolicy', policyId: policy.id, ...body }
                : { action: 'policy', ...body },
              { onSuccess: () => { appToast.success(policy ? 'Leave policy updated' : 'Leave policy added'); onClose() }, onError: (error) => appToast.error('Leave policy not saved', error, 'Could not save leave policy.') },
            )
          }}
        >
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Name
              <Input
                required
                value={name}
                placeholder="Paid leave"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              Counts as
              <ToggleGroup
                variant="outline"
                value={[category]}
                onValueChange={(value) => {
                  if (value[0]) setCategory(value[0] as LeaveCategory)
                }}
                aria-label="Leave category"
              >
                {(Object.keys(categoryStyles) as LeaveCategory[]).map((key) => (
                  <ToggleGroupItem key={key} value={key} className="px-3">
                    {categoryStyles[key].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            {category === 'paid' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Days earned per month
                    <Input
                      required
                      type="number"
                      min="0"
                      max="30"
                      step="0.25"
                      value={perMonth}
                      onChange={(event) => setPerMonth(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Carry into next year
                    <Input
                      required
                      type="number"
                      min="0"
                      max={annual}
                      step="0.5"
                      value={carry}
                      onChange={(event) => setCarry(event.target.value)}
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={accrues}
                    onCheckedChange={(value) => setAccrues(value === true)}
                  />
                  Earn it month by month
                </label>
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {annual} days a year.{' '}
                  {accrues
                    ? `Someone who joins in July has ${Math.round(Number(perMonth || 0) * 6 * 10) / 10} days by December.`
                    : 'The full year is available right away.'}{' '}
                  {Number(carry) > 0
                    ? `Up to ${carry} unused days move into next year.`
                    : 'Unused days reset on 1 January.'}
                </p>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={half}
                onCheckedChange={(value) => setHalf(value === true)}
              />
              Allow half-days
            </label>
            {(action.isError || remove.isError) && (
              <p className="text-sm text-destructive">
                {(action.error ?? remove.error)?.message}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            {policy && (
              <Button
                type="button"
                variant="destructive-outline"
                className="sm:mr-auto"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { action: 'removePolicy', policyId: policy.id },
                    { onSuccess: () => { appToast.warning('Leave policy removed'); onClose() }, onError: (error) => appToast.error('Leave policy not removed', error, 'Could not remove leave policy.') },
                  )
                }
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            )}
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" loading={action.isPending}>
              {policy ? 'Save' : 'Add leave type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
