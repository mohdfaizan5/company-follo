import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { EmptyState } from '#/components/empty-state'
import { CalendarSkeleton } from '#/components/page-skeletons'
import { TimeOffCalendar, categoryOf, categoryStyles, formatDay, formatRange, holidayStyle } from '#/components/time-off-calendar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import { meQueryOptions } from '#/routes/dashboard/me'
import { appToast } from '#/lib/toast'
import type { Me } from '#/routes/dashboard/me'

/** A person's own calendar: company holidays and their own leave, read-only, plus requesting time off. */
export const Route = createFileRoute('/dashboard/my-calendar')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    void context.queryClient.prefetchQuery(meQueryOptions)
  },
  component: MyCalendarPage,
})

function MyCalendarPage() {
  const me = useQuery(meQueryOptions)
  const [requesting, setRequesting] = useState(false)
  const data = me.data
  return (
    <DashboardPage
      title="Calendar"
      description="Company holidays and your time off."
      skeleton="calendar"
      wide
      actions={data?.person && data.leaveTypes.length ? <Button onClick={() => setRequesting(true)}><Plus data-icon="inline-start" />Request leave</Button> : undefined}
    >
      {me.isPending && <CalendarSkeleton />}
      {me.isError && <p className="text-sm text-destructive">{me.error.message}</p>}
      {data && <>
        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <TimeOffCalendar
              holidays={data.holidays}
              requests={data.person ? data.leave.map((leave) => ({ ...leave, first_name: 'You', last_name: null })) : []}
              today={data.today}
              workingDays={data.company.working_days}
            />
          </div>
          <div className="flex flex-col gap-5">
            <Balances data={data} />
            <Holidays data={data} />
          </div>
        </div>
        <MyRequests data={data} />
        {requesting && <RequestDialog data={data} onClose={() => setRequesting(false)} />}
      </>}
    </DashboardPage>
  )
}

function Balances({ data }: { data: Me }) {
  if (!data.balances.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Your balance</CardTitle><CardDescription>Paid days you can still take this year.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.balances.map((balance) => (
          <div key={balance.policy_id} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{balance.name}</span>
            <span className={cn('font-semibold tabular-nums', balance.available < 0 && 'text-destructive')}>{balance.available < 0 ? `${-balance.available} over` : `${balance.available} left`}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Holidays({ data }: { data: Me }) {
  const upcoming = data.holidays.filter((holiday) => holiday.date >= data.today).slice(0, 6)
  return (
    <Card>
      <CardHeader><CardTitle>Upcoming holidays</CardTitle></CardHeader>
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

function useMeAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: object) => {
      const response = await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save.')
      return payload
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['me'] }) },
  })
}

function MyRequests({ data }: { data: Me }) {
  const cancel = useMeAction()
  const upcoming = data.leave.filter((leave) => leave.end_date >= data.today || leave.status === 'pending')
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold">Your requests</h2>
      {upcoming.length ? (
        <div className="divide-y rounded-xl border bg-card">
          {upcoming.map((leave) => {
            const style = categoryStyles[categoryOf(leave.policy_category)]
            return (
              <div key={leave.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', style.chip)}><span className={cn('size-1.5 rounded-full', style.dot)} />{leave.policy_name}</span>
                <span className="tabular-nums">{formatRange(leave.start_date, leave.end_date)}</span>
                <span className="text-muted-foreground tabular-nums">{Number(leave.duration_days)} {Number(leave.duration_days) === 1 ? 'day' : 'days'}</span>
                {leave.reason && <span className="min-w-0 flex-1 truncate text-muted-foreground">{leave.reason}</span>}
                <span className="ml-auto flex items-center gap-2">
                  {leave.status === 'pending' ? <Badge variant="warning">Awaiting approval</Badge> : leave.status === 'approved' ? <Badge variant="success">Approved</Badge> : <Badge variant="secondary" className="capitalize">{leave.status}</Badge>}
                  {leave.status === 'pending' && <Button size="xs" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({ action: 'cancelRequest', requestId: leave.id }, { onSuccess: () => appToast.info('Leave request cancelled') })}>Cancel</Button>}
                </span>
              </div>
            )
          })}
        </div>
      ) : <div className="rounded-xl border"><EmptyState icon={CalendarDays} title="Nothing planned" description="Requests you make show up here until they are over." /></div>}
      {cancel.isError && <p className="mt-2 text-sm text-destructive">{cancel.error.message}</p>}
    </section>
  )
}

function RequestDialog({ data, onClose }: { data: Me; onClose: () => void }) {
  const types = data.leaveTypes
  const [policyId, setPolicyId] = useState(types[0]?.id ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [reason, setReason] = useState('')
  const action = useMeAction()
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>HR or your manager reviews it. Weekly offs and holidays are not counted.</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={(event) => { event.preventDefault(); action.mutate({ action: 'requestLeave', policyId, startDate, endDate: endDate || startDate, halfDay, reason }, { onSuccess: () => { appToast.success('Leave request sent', { description: 'It is ready for review.' }); onClose() }, onError: (error) => appToast.error('Leave request not sent', error, 'Could not send the leave request.') }) }}>
          <DialogPanel className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">Type
              <NativeSelect required value={policyId} onChange={(event) => setPolicyId(event.target.value)}>
                {types.map((type) => <NativeSelectOption key={type.id} value={type.id}>{type.name}</NativeSelectOption>)}
              </NativeSelect>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">From<Input required type="date" min={data.today} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">To<Input type="date" min={startDate || data.today} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={halfDay} onCheckedChange={(value) => setHalfDay(value === true)} />Half-day</label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">Reason<Textarea required value={reason} placeholder="Why do you need this time off?" onChange={(event) => setReason(event.target.value)} /></label>
            {action.isError && <p className="text-sm text-destructive">{action.error.message}</p>}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" loading={action.isPending} disabled={!reason.trim()}>Send request</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
