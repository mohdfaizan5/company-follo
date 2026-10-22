import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { EmployeeDocumentUpload, EmployeePhotoUpload } from '#/components/employee-uploads'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Frame, FramePanel } from '#/components/ui/frame'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { personName } from '#/lib/people-client'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'

type Profile = {
  person: {
    id: string; first_name: string; last_name: string | null; work_email: string | null; phone_number: string | null; personal_email: string | null; address: string | null; avatar_url: string | null;
    notes: string | null; title: string; department: string | null; level: string | null; start_date: string;
    manager_first_name: string | null; manager_last_name: string | null; company_name: string
  }
  compensation: { id: string; kind: string; amount: string; currency: 'INR' | 'USD'; effective_from: string }[]
  payments: { id: string; amount: string; currency: 'INR' | 'USD'; status: string; paid_on: string | null; created_at: string }[]
  expenses: { id: string; label: string; amount: string; currency: 'INR' | 'USD'; incurred_on: string }[]
  documents: { id: string; file_name: string; display_name: string | null; kind: string }[]
  uploadsEnabled: boolean
  canWritePeople: boolean
  payrollAllowed: boolean
  expensesAllowed: boolean
}

async function getProfile(personId: string) {
  const response = await fetch(`/api/people/${personId}`)
  const payload = await response.json() as Profile & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load this person.')
  return payload
}

export const Route = createFileRoute('/dashboard/people/$personId')({
  loader: async ({ context, params }) => {
    if (typeof window === 'undefined') return
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions),
      context.queryClient.ensureQueryData({
        queryKey: ['person', params.personId],
        queryFn: () => getProfile(params.personId),
        staleTime: 60_000,
      }),
    ])
  },
  component: PersonProfile,
})

function PersonProfile() {
  const { personId } = Route.useParams()
  return <DashboardPage title="Person profile"><ProfileContent personId={personId} /></DashboardPage>
}

function ProfileContent({ personId }: { personId: string }) {
  const profile = useQuery({ queryKey: ['person', personId], queryFn: () => getProfile(personId), staleTime: 60_000 })
  const workspace = useWorkspace(true)
  if (profile.isPending) return <p className="text-sm text-muted-foreground">Loading profile…</p>
  if (profile.isError) return <p className="text-sm text-destructive">{profile.error.message}</p>
  const { person, compensation, payments, expenses, documents, uploadsEnabled, canWritePeople, payrollAllowed, expensesAllowed } = profile.data
  const name = personName(person)
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const manager = person.manager_first_name ? `${person.manager_first_name} ${person.manager_last_name ?? ''}`.trim() : 'No manager'
  return <>
    <div className="mb-5 flex items-center justify-between gap-3"><Button variant="ghost" render={<Link to="/dashboard/people" />}><ArrowLeft data-icon="inline-start" />All people</Button><div className="flex items-center gap-2">{canWritePeople && workspace.data?.role !== 'employee' && <InvitePerson person={person} isOwner={workspace.data?.role === 'owner'} />}{canWritePeople && <EditPerson person={person} />}</div></div>
    <Frame className="mb-6"><FramePanel className="flex flex-wrap items-center gap-4">{canWritePeople ? <EmployeePhotoUpload personId={person.id} enabled={uploadsEnabled}><Avatar className="size-14">{person.avatar_url && <AvatarImage src={person.avatar_url} alt={name} />}<AvatarFallback>{initials}</AvatarFallback></Avatar></EmployeePhotoUpload> : <Avatar className="size-14">{person.avatar_url && <AvatarImage src={person.avatar_url} alt={name} />}<AvatarFallback>{initials}</AvatarFallback></Avatar>}<div className="min-w-0 flex-1"><h2 className="text-xl font-semibold tracking-[-0.03em]">{name}</h2><p className="text-sm text-muted-foreground">{person.title} · {person.company_name}</p><p className="mt-1 text-xs text-muted-foreground">{person.work_email || person.personal_email || 'No email added'} · Joined {person.start_date.slice(0, 10)}</p></div>{canWritePeople && <div className="text-xs text-muted-foreground">Click the photo to change it</div>}</FramePanel></Frame>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Work details</CardTitle><CardDescription>Current details for this person.</CardDescription></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Joined" value={person.start_date.slice(0, 10)} /><Detail label="Reports to" value={manager} /><Detail label="Department" value={person.department || 'Not added'} /><Detail label="Level" value={person.level || 'Not added'} /><Detail label="Work email" value={person.work_email || 'Not added'} /><Detail label="Phone" value={person.phone_number || 'Not added'} /></dl></CardContent></Card>
        <Card><CardHeader><CardTitle>Personal details</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Personal email" value={person.personal_email || 'Not added'} /><Detail label="Address" value={person.address || 'Not added'} /></dl></CardContent></Card>
        <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{person.notes || 'No notes yet. Use “Edit details” to add one.'}</CardContent></Card>
        {payrollAllowed && <Card><CardHeader><CardTitle>Payments</CardTitle><CardDescription>{payments.length} recorded</CardDescription></CardHeader><CardContent>{payments.length ? <div className="divide-y divide-border">{payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="capitalize">{payment.status}<span className="block text-xs text-muted-foreground">{(payment.paid_on ?? payment.created_at).slice(0, 10)}</span></span><span className="font-medium tabular-nums">{formatMoney(payment.amount, payment.currency)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No payments recorded for this person.</p>}<Button className="mt-4" variant="outline" render={<Link to="/dashboard/payroll" />}>Open payments</Button></CardContent></Card>}
      </div>
      <div className="space-y-5">
        {payrollAllowed && <Card><CardHeader><CardTitle>Compensation</CardTitle><CardDescription>Salary and bonus records.</CardDescription></CardHeader><CardContent>{compensation.length ? <div className="space-y-3">{compensation.map((record) => <div key={record.id} className="flex justify-between gap-3 text-sm"><span className="capitalize">{record.kind}<span className="block text-xs text-muted-foreground">From {record.effective_from.slice(0, 10)}</span></span><span className="tabular-nums">{formatMoney(record.amount, record.currency)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No compensation recorded yet.</p>}</CardContent></Card>}
        {expensesAllowed && <Card><CardHeader><CardTitle>Expenses</CardTitle><CardDescription>Expenses linked to this person.</CardDescription></CardHeader><CardContent>{expenses.length ? <div className="space-y-3">{expenses.map((expense) => <div key={expense.id} className="flex justify-between gap-3 text-sm"><span>{expense.label}<span className="block text-xs text-muted-foreground">{expense.incurred_on.slice(0, 10)}</span></span><span className="tabular-nums">{formatMoney(expense.amount, expense.currency)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No expenses linked to this person.</p>}</CardContent></Card>}
        <Card><CardHeader><CardTitle>Documents</CardTitle><CardDescription>Private files on this person’s record.</CardDescription></CardHeader><CardContent>{documents.length ? <ul className="space-y-2 text-sm">{documents.map((document) => <li key={document.id} className="flex items-center justify-between gap-2"><div className="min-w-0"><a className="block truncate font-medium underline-offset-2 hover:underline" href={`/api/people/${person.id}/files/${document.id}`} target="_blank" rel="noreferrer">{document.display_name || document.file_name}</a><span className="text-xs capitalize text-muted-foreground">{document.kind.replaceAll('_', ' ')}</span></div>{canWritePeople && <RenameDocument personId={person.id} document={document} />}</li>)}</ul> : <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}{canWritePeople && <EmployeeDocumentUpload personId={person.id} enabled={uploadsEnabled} />}</CardContent></Card>
      </div>
    </div>
  </>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>
}

function formatMoney(amount: string, currency: 'INR' | 'USD') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(amount))
}

function EditPerson({ person }: { person: Profile['person'] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [address, setAddress] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [notes, setNotes] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/people/${person.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, title, email, phone, personalEmail, address, department, level, startDate, notes }) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save details.')
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['person', person.id] }),
        queryClient.invalidateQueries({ queryKey: ['people'] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
      ])
      setOpen(false)
    },
  })
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); save.mutate() }
  function openChange(next: boolean) {
    if (next) {
      save.reset()
      setName(personName(person))
      setTitle(person.title)
      setEmail(person.work_email ?? '')
      setPhone(person.phone_number ?? '')
      setPersonalEmail(person.personal_email ?? '')
      setAddress(person.address ?? '')
      setDepartment(person.department ?? '')
      setLevel(person.level ?? '')
      setStartDate(person.start_date.slice(0, 10))
      setNotes(person.notes ?? '')
    }
    setOpen(next)
  }
  return <Dialog open={open} onOpenChange={openChange}><DialogTrigger render={<Button variant="outline" />}><Pencil data-icon="inline-start" />Edit details</DialogTrigger><DialogPopup className="max-h-[min(90dvh,800px)] sm:max-w-2xl"><DialogHeader><DialogTitle>Edit person</DialogTitle><DialogDescription>Update this person’s work and contact details.</DialogDescription></DialogHeader><form className="contents" onSubmit={submit}><DialogPanel className="grid gap-4 overflow-y-auto sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-sm font-medium">Name<Input required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Role<Input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Work email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Phone<Input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Personal email<Input type="email" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Address<Input value={address} onChange={(event) => setAddress(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Department<Input value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Level<Input value={level} onChange={(event) => setLevel(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">Joined on<Input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">Notes<textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{save.isError ? <p className="text-sm text-destructive sm:col-span-2">{save.error.message}</p> : null}</DialogPanel><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button type="submit" loading={save.isPending}>Save details</Button></DialogFooter></form></DialogPopup></Dialog>
}

function InvitePerson({ person, isOwner }: { person: Profile['person']; isOwner: boolean }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<'employee' | 'hr_admin'>('employee')
  const [copied, setCopied] = useState(false)
  const invite = useMutation({ mutationFn: async () => {
    const response = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId: person.id, role }) })
    const payload = await response.json() as { url?: string; error?: string }
    if (!response.ok || !payload.url) throw new Error(payload.error ?? 'Could not create invitation.')
    return payload.url
  } })
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { invite.reset(); setCopied(false) } }}><DialogTrigger render={<Button variant="outline" disabled={!person.personal_email} />}>Invite</DialogTrigger><DialogPopup><DialogHeader><DialogTitle>Invite {personName(person)}</DialogTitle><DialogDescription>Make a one-time setup link for {person.personal_email || 'their personal email'}. The link expires in 7 days.</DialogDescription></DialogHeader><DialogPanel className="space-y-4"><label className="block text-sm font-medium">Access role<NativeSelect className="mt-1.5 w-full" value={role} onChange={(event) => setRole(event.target.value as 'employee' | 'hr_admin')}><NativeSelectOption value="employee">Employee</NativeSelectOption>{isOwner && <NativeSelectOption value="hr_admin">HR admin</NativeSelectOption>}</NativeSelect></label><p className="text-xs leading-5 text-muted-foreground">Their role controls which areas they can read or change. The owner can edit permissions in Settings.</p>{invite.data && <div><label className="block text-xs font-medium">Setup link<Input readOnly className="mt-1.5" value={invite.data} onFocus={(event) => event.target.select()} /></label><Button type="button" className="mt-2" variant="outline" onClick={() => { void navigator.clipboard.writeText(invite.data).then(() => setCopied(true)) }}>{copied ? 'Copied' : 'Copy link'}</Button></div>}{invite.isError && <p role="alert" className="text-sm text-destructive">{invite.error.message}</p>}</DialogPanel><DialogFooter><DialogClose render={<Button variant="outline" />}>Close</DialogClose><Button type="button" loading={invite.isPending} onClick={() => invite.mutate()}>{invite.data ? 'Regenerate link' : 'Create link'}</Button></DialogFooter></DialogPopup></Dialog>
}

function RenameDocument({ personId, document }: { personId: string; document: Profile['documents'][number] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(document.display_name || document.file_name)
  const queryClient = useQueryClient()
  const save = useMutation({ mutationFn: async () => {
    const response = await fetch(`/api/people/${personId}/files/${document.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) })
    const payload = await response.json() as { error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'Could not rename document.')
  }, onSuccess: () => { setOpen(false); void queryClient.invalidateQueries({ queryKey: ['person', personId] }) } })
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button size="sm" variant="ghost" />}>Rename</DialogTrigger><DialogPopup><DialogHeader><DialogTitle>Rename document</DialogTitle><DialogDescription>The file stays the same; only the name shown here changes.</DialogDescription></DialogHeader><form className="contents" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><DialogPanel><label className="block text-sm font-medium">Document name<Input className="mt-1.5" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>{save.isError && <p role="alert" className="mt-3 text-sm text-destructive">{save.error.message}</p>}</DialogPanel><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button type="submit" loading={save.isPending}>Save name</Button></DialogFooter></form></DialogPopup></Dialog>
}
