import { useMemo } from 'react'
import { Kloq, KloqNav, KloqToolbar } from '#/components/kloq'
import type { CalEvent } from '#/components/kloq'
import '#/components/kloq/styles/kloq.css'

type Holiday = { id: string; name: string; date: string }
type Leave = {
  id: string; first_name: string; last_name: string | null; policy_name: string
  start_date: string; end_date: string; status: string; entry_type: string
  created_by_name: string | null; created_by_role: string | null
}

function nextDay(date: string) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 1)
  return day.toISOString().slice(0, 10)
}

function leaveColor(leave: Leave): NonNullable<CalEvent['color']> {
  return leave.entry_type === 'recorded' ? 'blue' : leave.status === 'pending' ? 'amber' : 'emerald'
}

export function TimeOffCalendar({ holidays, requests, today }: { holidays: Holiday[]; requests: Leave[]; today: string }) {
  const events = useMemo<CalEvent[]>(() => [
    ...holidays.map((holiday) => ({ id: `holiday:${holiday.id}`, title: holiday.name, description: 'Company holiday', allDay: true as const, start: holiday.date, end: nextDay(holiday.date), color: 'violet' as const, readOnly: true })),
    ...requests.filter((leave) => leave.status === 'pending' || leave.status === 'approved').map((leave) => ({
      id: `leave:${leave.id}`,
      title: `${leave.first_name} ${leave.last_name ?? ''} · ${leave.entry_type === 'recorded' ? 'Recorded' : leave.status === 'pending' ? 'Pending' : 'Approved'}`,
      description: `${leave.policy_name}${leave.created_by_role ? ` · Entered by ${leave.created_by_role === 'owner' ? 'owner' : 'HR'}${leave.created_by_name ? ` ${leave.created_by_name}` : ''}` : ''}`,
      allDay: true as const, start: leave.start_date, end: nextDay(leave.end_date),
      color: leaveColor(leave),
      readOnly: true,
    })),
  ], [holidays, requests])

  return <div className="h-[650px] min-w-0 overflow-hidden rounded-lg border bg-card">
    <Kloq events={events} defaultDate={new Date(`${today}T12:00:00`)} defaultView="month" theme="coss" scheme="dark" storage={false} commandPalette={false} designMode={false} workingHours={false}>
      <KloqToolbar><KloqNav /></KloqToolbar>
    </Kloq>
  </div>
}
