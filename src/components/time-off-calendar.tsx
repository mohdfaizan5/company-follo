import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Tooltip, TooltipPopup, TooltipTrigger } from '#/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { cn } from '#/lib/utils'

export type CalendarHoliday = { id: string; name: string; kind: string; date: string }
export type CalendarLeave = {
  id: string; first_name: string; last_name: string | null; policy_name: string; policy_category: string
  start_date: string; end_date: string; status: string; reason: string | null
}
export type LeaveCategory = 'paid' | 'unpaid' | 'wfh'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Colour per leave category, shared with the legend and the leave table. */
export const categoryStyles: Record<LeaveCategory, { label: string; chip: string; dot: string }> = {
  paid: { label: 'Paid leave', chip: 'bg-emerald-500/14 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  unpaid: { label: 'Unpaid leave', chip: 'bg-amber-500/14 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  wfh: { label: 'Work from home', chip: 'bg-sky-500/14 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
}
export const holidayStyle = { chip: 'bg-violet-500/14 text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' }

export function categoryOf(value: string): LeaveCategory {
  return value === 'unpaid' || value === 'wfh' ? value : 'paid'
}

export function formatDay(date: string, withYear = false) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' })
}

export function formatRange(start: string, end: string) {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`
}

function iso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function monthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const count = Math.ceil((offset + days) / 7) * 7
  return Array.from({ length: count }, (_, index) => {
    const date = iso(year, month, index - offset + 1)
    return { date, inMonth: index >= offset && index < offset + days }
  })
}

type DayInfo = { holiday?: CalendarHoliday; leaves: CalendarLeave[] }

export function TimeOffCalendar({ holidays, requests, today, workingDays, onHolidayClick }: {
  holidays: CalendarHoliday[]
  requests: CalendarLeave[]
  today: string
  workingDays: number[]
  onHolidayClick?: (holiday: CalendarHoliday) => void
}) {
  const [view, setView] = useState<'month' | 'year'>('month')
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }))
  const working = useMemo(() => new Set(workingDays), [workingDays])

  // Index holidays and leave by date. Leave is only drawn on working days that are not holidays.
  const days = useMemo(() => {
    const map = new Map<string, DayInfo>()
    const at = (date: string) => {
      let info = map.get(date)
      if (!info) map.set(date, (info = { leaves: [] }))
      return info
    }
    for (const holiday of holidays) at(holiday.date).holiday = holiday
    for (const leave of requests) {
      if (leave.status !== 'approved' && leave.status !== 'pending') continue
      for (let ms = Date.parse(`${leave.start_date}T00:00:00Z`); ms <= Date.parse(`${leave.end_date}T00:00:00Z`); ms += 86400000) {
        const date = new Date(ms).toISOString().slice(0, 10)
        if (!working.has(weekday(date)) || map.get(date)?.holiday) continue
        at(date).leaves.push(leave)
      }
    }
    return map
  }, [holidays, requests, working])

  function shift(step: number) {
    setCursor((current) => {
      if (view === 'year') return { ...current, year: current.year + step }
      const month = current.month + step
      return { year: current.year + Math.floor(month / 12), month: ((month % 12) + 12) % 12 }
    })
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={view === 'year' ? 'Previous year' : 'Previous month'} onClick={() => shift(-1)}><ChevronLeft /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={view === 'year' ? 'Next year' : 'Next month'} onClick={() => shift(1)}><ChevronRight /></Button>
          <h2 className="ml-1 text-base font-semibold tabular-nums">{view === 'year' ? cursor.year : `${MONTHS[cursor.month]} ${cursor.year}`}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })}>Today</Button>
          <ToggleGroup variant="outline" size="sm" value={[view]} onValueChange={(value) => { if (value[0]) setView(value[0] as 'month' | 'year') }} aria-label="Calendar view">
            <ToggleGroupItem value="month" className="px-2.5">Month</ToggleGroupItem>
            <ToggleGroupItem value="year" className="px-2.5">Year</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {view === 'month'
        ? <MonthGrid year={cursor.year} month={cursor.month} days={days} today={today} working={working} onHolidayClick={onHolidayClick} />
        : <YearGrid year={cursor.year} days={days} today={today} working={working} onPickMonth={(month) => { setCursor({ year: cursor.year, month }); setView('month') }} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
        {(Object.keys(categoryStyles) as LeaveCategory[]).map((key) => <span key={key} className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', categoryStyles[key].dot)} />{categoryStyles[key].label}</span>)}
        <span className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', holidayStyle.dot)} />Holiday</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full border border-dashed border-muted-foreground" />Awaiting approval</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/24" />Weekly off</span>
      </div>
    </div>
  )
}

function MonthGrid({ year, month, days, today, working, onHolidayClick }: { year: number; month: number; days: Map<string, DayInfo>; today: string; working: Set<number>; onHolidayClick?: (holiday: CalendarHoliday) => void }) {
  const cells = monthCells(year, month)
  return (
    <div className="p-2 sm:p-3">
      <div className="grid grid-cols-7 pb-1.5 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((day, index) => <span key={day} className={cn(!working.has((index + 1) % 7) && 'text-muted-foreground/48')}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const info = days.get(date)
          const off = !working.has(weekday(date))
          const leaves = info?.leaves ?? []
          return (
            <div
              key={date}
              className={cn(
                'flex min-h-20 min-w-0 flex-col gap-1 rounded-lg p-1.5 sm:min-h-24',
                !inMonth && 'opacity-40',
                off ? 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-muted)_6px_7px)] text-muted-foreground/64' : 'bg-muted/40',
                info?.holiday && 'bg-violet-500/8',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('grid size-6 place-items-center rounded-full text-xs tabular-nums', date === today && 'bg-primary font-semibold text-primary-foreground')}>{Number(date.slice(8))}</span>
                {off && inMonth && !info?.holiday && <span className="text-[10px] uppercase tracking-wide">Off</span>}
              </div>
              {info?.holiday && (
                <button
                  type="button"
                  disabled={!onHolidayClick}
                  onClick={() => info.holiday && onHolidayClick?.(info.holiday)}
                  className={cn('truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium enabled:hover:opacity-80', holidayStyle.chip)}
                  title={info.holiday.name}
                >
                  {info.holiday.name}
                </button>
              )}
              {leaves.slice(0, 3).map((leave) => <LeaveChip key={leave.id} leave={leave} />)}
              {leaves.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{leaves.length - 3} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeaveChip({ leave }: { leave: CalendarLeave }) {
  const style = categoryStyles[categoryOf(leave.policy_category)]
  const pending = leave.status === 'pending'
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={cn('truncate rounded px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring', style.chip, pending && 'border border-dashed border-current bg-transparent')} />}>
        {leave.first_name}
      </TooltipTrigger>
      <TooltipPopup>
        <p className="font-medium">{leave.first_name} {leave.last_name ?? ''} · {leave.policy_name}</p>
        <p className="text-muted-foreground">{formatRange(leave.start_date, leave.end_date)}{pending ? ' · awaiting approval' : ''}</p>
        {leave.reason && <p className="text-muted-foreground">{leave.reason}</p>}
      </TooltipPopup>
    </Tooltip>
  )
}

function YearGrid({ year, days, today, working, onPickMonth }: { year: number; days: Map<string, DayInfo>; today: string; working: Set<number>; onPickMonth: (month: number) => void }) {
  return (
    <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MONTHS.map((name, month) => (
        <div key={name}>
          <button type="button" onClick={() => onPickMonth(month)} className="mb-2 text-sm font-medium hover:text-primary">{name}</button>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
            {WEEKDAYS.map((day) => <span key={day} className="text-muted-foreground/64">{day[0]}</span>)}
            {monthCells(year, month).map(({ date, inMonth }) => {
              if (!inMonth) return <span key={date} />
              const info = days.get(date)
              const off = !working.has(weekday(date))
              const leave = info?.leaves[0]
              const label = [info?.holiday?.name, ...(info?.leaves.map((item) => `${item.first_name}: ${item.policy_name}`) ?? [])].filter(Boolean).join('\n')
              return (
                <span
                  key={date}
                  title={label || undefined}
                  className={cn(
                    'relative grid aspect-square place-items-center rounded tabular-nums',
                    off && 'text-muted-foreground/40',
                    info?.holiday && cn(holidayStyle.chip, 'font-medium'),
                    !info?.holiday && leave && categoryStyles[categoryOf(leave.policy_category)].chip,
                    date === today && 'ring-1 ring-primary',
                  )}
                >
                  {Number(date.slice(8))}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
