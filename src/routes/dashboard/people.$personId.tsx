import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CalendarDays, CircleDollarSign, Ellipsis, Mail, Network, Pencil, Plus, Receipt, RotateCcw, Send, Trash2, UserMinus, UserRound, Users, Wallet, X } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { ProfileSkeleton } from '#/components/page-skeletons'
import { EmployeeDocumentUpload, EmployeePhotoUpload } from '#/components/employee-uploads'
import { appToast } from '#/lib/toast'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#/components/ui/breadcrumb'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '#/components/ui/dialog'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '#/components/ui/menu'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Progress } from '#/components/ui/progress'
import { Separator } from '#/components/ui/separator'
import { Textarea } from '#/components/ui/textarea'
import { getPersonProfile, peopleQueryOptions, personName } from '#/lib/people-client'
import type { Invitation, PersonProfile as Profile } from '#/lib/people-client'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'

export const Route = createFileRoute('/dashboard/people/$personId')({
  loader: async ({ context, params }) => {
    if (typeof window === 'undefined') return
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions),
      context.queryClient.ensureQueryData({
        queryKey: ['person', params.personId],
        queryFn: () => getPersonProfile(params.personId),
        staleTime: 60_000,
      }),
    ])
  },
  component: PersonProfile,
})

function PersonProfile() {
  const { personId } = Route.useParams()
  return <DashboardPage title="Person profile" showHeading={false} skeleton="profile"><ProfileContent personId={personId} /></DashboardPage>
}

const invitationLabel: Record<Invitation, string> = { none: 'Not invited yet', pending: 'Invite sent', accepted: 'Joined the workspace', expired: 'Invite expired' }

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMoney(amount: string, currency: 'INR' | 'USD') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(amount))
}

function ProfileContent({ personId }: { personId: string }) {
  const profile = useQuery({ queryKey: ['person', personId], queryFn: () => getPersonProfile(personId), staleTime: 60_000 })
  const workspace = useWorkspace(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const queryClient = useQueryClient()
  const rehire = useMutation({
    mutationFn: () => employmentAction(personId, { action: 'rehire' }),
    // Wait for the refreshed record so the banner and menu change together with the button.
    onSuccess: () => { appToast.success('Person rehired'); return Promise.all([queryClient.invalidateQueries({ queryKey: ['person', personId] }), queryClient.invalidateQueries({ queryKey: ['people'] })]) },
    onError: (error) => appToast.error('Person not rehired', error, 'Could not rehire this person.'),
  })
  if (profile.isPending) return <ProfileSkeleton />
  if (profile.isError) return <p className="text-sm text-destructive">{profile.error.message}</p>
  const { person, invitation, compensation, payments, expenses, documents, uploadsEnabled, canWritePeople, payrollAllowed, expensesAllowed } = profile.data
  const name = personName(person)
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const manager = person.manager_first_name ? `${person.manager_first_name} ${person.manager_last_name ?? ''}`.trim() : null
  const former = person.status === 'ended'
  // A former person's record is kept as it was; only Rehire and permanent delete change it.
  const canEdit = canWritePeople && !former
  const canManage = canWritePeople && workspace.data?.role !== 'employee'
  const canInvite = canEdit && workspace.data?.role !== 'employee'
  const avatar = <Avatar className="size-20 sm:size-24">{person.avatar_url && <AvatarImage src={person.avatar_url} alt={name} />}<AvatarFallback className="bg-primary/16 text-2xl font-semibold text-primary">{initials}</AvatarFallback></Avatar>

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
    {/* ── Top bar: breadcrumb on the left, Invite / Edit details / more menu on the right ── */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink className="inline-flex items-center gap-1.5" render={<Link to="/dashboard/people" />}><Users className="size-4" aria-hidden="true" />People</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage className="max-w-48 truncate sm:max-w-80">{name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-2">
        {canInvite && <Button variant="outline" disabled={!person.personal_email} onClick={() => setInviteOpen(true)}><Send data-icon="inline-start" />Invite</Button>}
        {canEdit && <Button variant="outline" render={<Link to="/dashboard/people/$personId/edit" params={{ personId: person.id }} />}><Pencil data-icon="inline-start" />Edit details</Button>}
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}><Ellipsis /></MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => { void navigator.clipboard.writeText(window.location.href).then(() => appToast.info('Profile link copied')).catch((error) => appToast.error('Link not copied', error, 'Could not copy the profile link.')) }}>Copy profile link</MenuItem>
            <MenuItem render={<Link to="/dashboard/people" />}><Network />Open reporting tree</MenuItem>
            {canManage && !former && <MenuItem variant="destructive" onClick={() => setLeaving(true)}><UserMinus />Let go…</MenuItem>}
            {canManage && former && <MenuItem onClick={() => rehire.mutate()}><RotateCcw />Rehire</MenuItem>}
            {canManage && former && workspace.data?.role === 'owner' && <MenuItem variant="destructive" onClick={() => setDeleting(true)}><Trash2 />Delete permanently…</MenuItem>}
          </MenuPopup>
        </Menu>
      </div>
    </div>

    {/* ── Header: photo (click to change), name, role · company, joined + invitation badges ── */}
    <header className="flex flex-wrap items-center gap-5">
      {canEdit ? <EmployeePhotoUpload personId={person.id} enabled={uploadsEnabled}>{avatar}</EmployeePhotoUpload> : avatar}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">{name}</h1>
          <p className="text-muted-foreground">{person.title} · {person.company_name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" size="lg"><CalendarDays aria-hidden="true" />Joined {formatDate(person.start_date)}</Badge>
          {former && person.end_date
            ? <Badge variant="error" size="lg"><UserMinus aria-hidden="true" />Left {formatDate(person.end_date)}</Badge>
            : <Badge variant={invitation === 'accepted' ? 'success' : 'outline'} size="lg"><Mail aria-hidden="true" />{invitationLabel[invitation]}</Badge>}
        </div>
      </div>
    </header>

    {former && <div className="flex flex-wrap items-start gap-3 rounded-xl border border-destructive/24 bg-destructive/6 px-4 py-3 text-sm">
      <UserMinus className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name} {person.end_reason === 'resigned' ? 'resigned' : person.end_reason === 'let_go' ? 'was let go' : person.end_reason === 'contract_ended' ? 'finished their contract' : person.end_reason === 'internship_ended' ? 'finished their internship' : 'left'}{person.end_date ? ` on ${formatDate(person.end_date)}` : ''}.</p>
        <p className="text-muted-foreground">{person.exit_note ? `${person.exit_note.trim().replace(/[.!?]?$/, '.')} ` : ''}Their record is kept for history and hidden from People, Calendar and new payments. They can no longer sign in.</p>
      </div>
      {canManage && <Button size="sm" variant="outline" loading={rehire.isPending} onClick={() => rehire.mutate()}><RotateCcw data-icon="inline-start" />Rehire</Button>}
      {rehire.isError && <p className="w-full text-destructive">{rehire.error.message}</p>}
    </div>}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-col gap-8">
        {/* Setup checklist: progress bar + chips for each missing detail; opens Edit details */}
        {canEdit && <SetupChecklist person={person} />}

        {/* Records: compensation, payments, expenses */}
        {(payrollAllowed || expensesAllowed) && <section className="flex flex-col gap-3">
          <h2 className="px-1 font-heading text-base font-semibold">Records</h2>
          <Card className="divide-y">
            {payrollAllowed && <RecordRow
              icon={<Wallet aria-hidden="true" />} title="Compensation"
              summary={compensation.length ? `${compensation.length} record${compensation.length === 1 ? '' : 's'} · latest ${formatMoney(compensation[0].amount, compensation[0].currency)} ${compensation[0].kind}` : 'No salary or bonus records yet'}
              actions={canEdit ? <AddRecord personId={person.id} type="compensation" label="Add record" /> : null}
              items={compensation.slice(0, 3).map((record) => ({ id: record.id, label: <span className="capitalize">{record.kind}</span>, hint: `From ${formatDate(record.effective_from)}`, value: formatMoney(record.amount, record.currency) }))}
            />}
            {payrollAllowed && <RecordRow
              icon={<CircleDollarSign aria-hidden="true" />} title="Payments" summary={`${payments.length} recorded`}
              actions={<><Button variant="ghost" className="text-muted-foreground" render={<Link to="/dashboard/payroll" />}>Open payments</Button><Button variant="outline" render={<Link to="/dashboard/payroll" />}>Record payment</Button></>}
              items={payments.slice(0, 3).map((payment) => ({ id: payment.id, label: <span className="capitalize">{payment.status}</span>, hint: formatDate(payment.paid_on ?? payment.created_at), value: formatMoney(payment.amount, payment.currency) }))}
            />}
            {expensesAllowed && <RecordRow
              icon={<Receipt aria-hidden="true" />} title="Expenses" summary={expenses.length ? `${expenses.length} linked to this person` : 'None linked to this person'}
              actions={canEdit ? <AddRecord personId={person.id} type="expense" label="Add expense" /> : null}
              items={expenses.slice(0, 3).map((expense) => ({ id: expense.id, label: expense.label, hint: formatDate(expense.incurred_on), value: formatMoney(expense.amount, expense.currency) }))}
            />}
          </Card>
        </section>}

        {/* Documents: existing files, then the dropzone + name/type/upload row */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="font-heading text-base font-semibold">Documents</h2>
            <span className="text-sm text-muted-foreground">Private to admins</span>
          </div>
          <Card className="gap-4 p-5">
            {documents.length > 0 && <ul className="divide-y rounded-lg border text-sm">
              {documents.map((document) => <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <a className="block truncate font-medium underline-offset-2 hover:underline" href={`/api/people/${person.id}/files/${document.id}`} target="_blank" rel="noreferrer">{document.display_name || document.file_name}</a>
                  <span className="text-xs capitalize text-muted-foreground">{document.kind.replaceAll('_', ' ')}</span>
                </div>
                {canEdit && <RenameDocument personId={person.id} document={document} />}
              </li>)}
            </ul>}
            {canEdit ? <EmployeeDocumentUpload personId={person.id} enabled={uploadsEnabled} /> : documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents on this record.</p> : null}
          </Card>
        </section>

        {/* Notes: coss Textarea styled as in the p-textarea-9 particle (muted fill, no border or shadow) */}
        <NotesCard person={person} canWrite={canEdit} />
      </div>

      {/* ── Details sidebar: work / personal / access ── */}
      <DetailsCard person={person} manager={manager} invitation={invitation} canWrite={canEdit} canInvite={canInvite} onInvite={() => setInviteOpen(true)} />
    </div>

    {/* The invite dialog is controlled so the header button and the sidebar "Send" action can both open it */}
    {leaving && <LetGoDialog person={person} onClose={() => setLeaving(false)} />}
    {deleting && <DeletePersonDialog person={person} onClose={() => setDeleting(false)} />}
    {canInvite && <InvitePerson person={person} isOwner={workspace.data?.role === 'owner'} open={inviteOpen} onOpenChange={setInviteOpen} />}
  </div>
}

/** Card with a progress bar and a dashed chip per missing detail. Dismissal is remembered per person in this browser. */
function SetupChecklist({ person }: { person: Profile['person'] }) {
  const storageKey = `profile-checklist-dismissed:${person.id}`
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { try { setDismissed(window.localStorage.getItem(storageKey) === '1') } catch { /* storage unavailable */ } }, [storageKey])
  const fields = [
    { label: 'Role', done: Boolean(person.title) },
    { label: 'Joined', done: Boolean(person.start_date) },
    { label: 'Work email', done: Boolean(person.work_email) },
    { label: 'Personal email', done: Boolean(person.personal_email) },
    { label: 'Manager', done: Boolean(person.manager_employment_id) },
    { label: 'Department', done: Boolean(person.department) },
    { label: 'Level', done: Boolean(person.level) },
    { label: 'Phone', done: Boolean(person.phone_number) },
    { label: 'Address', done: Boolean(person.address) },
  ]
  const missing = fields.filter((field) => !field.done)
  if (dismissed || !missing.length) return null
  return <Card className="gap-4 p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-base font-semibold">Finish setting up this profile</h2>
        <p className="text-sm text-muted-foreground">{missing.length === 1 ? 'One detail is' : `${['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][missing.length] ?? missing.length} details are`} still missing.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap font-mono text-sm text-muted-foreground tabular-nums">{fields.length - missing.length} / {fields.length}</span>
        <Button variant="ghost" size="icon" aria-label="Dismiss checklist" onClick={() => { setDismissed(true); try { window.localStorage.setItem(storageKey, '1') } catch { /* storage unavailable */ } }}><X /></Button>
      </div>
    </div>
    <Progress value={fields.length - missing.length} max={fields.length} aria-label="Profile completion" />
    <div className="flex flex-wrap gap-2">
      {missing.map((field) => <Button key={field.label} variant="outline" size="sm" className="border-dashed" render={<Link to="/dashboard/people/$personId/edit" params={{ personId: person.id }} />}><Plus data-icon="inline-start" />{field.label}</Button>)}
    </div>
  </Card>
}

type RecordItem = { id: string; label: React.ReactNode; hint: string; value: string }

/** One row in the Records card: icon tile, title + summary, actions, and the most recent entries underneath. */
function RecordRow({ icon, title, summary, actions, items }: { icon: React.ReactNode; title: string; summary: string; actions?: React.ReactNode; items: RecordItem[] }) {
  return <div className="flex flex-col gap-3 p-4 sm:px-5">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-card text-foreground shadow-sm/5 [&_svg]:size-4">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {items.length > 0 && <ul className="divide-y rounded-lg border bg-muted/30 text-sm sm:ml-14">
      {items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="min-w-0 truncate">{item.label}<span className="ml-2 text-xs text-muted-foreground">{item.hint}</span></span>
        <span className="font-medium tabular-nums">{item.value}</span>
      </li>)}
    </ul>}
  </div>
}

/** Dialog that adds a compensation record or an expense for this person. */
function AddRecord({ personId, type, label }: { personId: string; type: 'compensation' | 'expense'; label: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('salary')
  const [text, setText] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/people/${personId}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, kind, label: text, amount, currency, date, notes }) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save this record.')
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['person', personId] }), queryClient.invalidateQueries({ queryKey: ['overview'] })])
      setOpen(false)
      appToast.success(compensation ? 'Compensation record saved' : 'Expense saved')
    },
    onError: (error) => appToast.error('Record not saved', error, 'Could not save this record.'),
  })
  function change(next: boolean) {
    if (next) { save.reset(); setKind('salary'); setText(''); setAmount(''); setCurrency('INR'); setDate(new Date().toISOString().slice(0, 10)); setNotes('') }
    setOpen(next)
  }
  const compensation = type === 'compensation'
  return <>
    <Button variant="outline" onClick={() => change(true)}>{label}</Button>
    <Dialog open={open} onOpenChange={change}>
      <DialogPopup>
        <DialogHeader><DialogTitle>{compensation ? 'Add compensation record' : 'Add expense'}</DialogTitle><DialogDescription>{compensation ? 'Salary, bonus or adjustment that applies from a date.' : 'An expense linked to this person.'}</DialogDescription></DialogHeader>
        <form className="contents" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
          <DialogPanel className="grid gap-4 sm:grid-cols-2">
            {compensation
              ? <Field><FieldLabel>Type</FieldLabel><NativeSelect className="w-full" value={kind} onChange={(event) => setKind(event.target.value)}><NativeSelectOption value="salary">Salary</NativeSelectOption><NativeSelectOption value="bonus">Bonus</NativeSelectOption><NativeSelectOption value="adjustment">Adjustment</NativeSelectOption></NativeSelect></Field>
              : <Field><FieldLabel>Description</FieldLabel><Input required maxLength={120} value={text} onChange={(event) => setText(event.target.value)} placeholder="e.g. Laptop" /></Field>}
            <Field><FieldLabel>{compensation ? 'Effective from' : 'Incurred on'}</FieldLabel><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
            <Field><FieldLabel>Amount</FieldLabel><Input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></Field>
            <Field><FieldLabel>Currency</FieldLabel><NativeSelect className="w-full" value={currency} onChange={(event) => setCurrency(event.target.value as 'INR' | 'USD')}><NativeSelectOption value="INR">INR</NativeSelectOption><NativeSelectOption value="USD">USD</NativeSelectOption></NativeSelect></Field>
            <Field className="sm:col-span-2"><FieldLabel>Notes <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
            {save.isError ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{save.error.message}</p> : null}
          </DialogPanel>
          <DialogFooter><DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose><Button type="submit" loading={save.isPending}>Save</Button></DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  </>
}

/** Notes card. The textarea uses the coss p-textarea-9 look: muted background, transparent border, no shadow. */
function NotesCard({ person, canWrite }: { person: Profile['person']; canWrite: boolean }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(person.notes ?? '')
  useEffect(() => { setNotes(person.notes ?? '') }, [person.notes])
  const save = useMutation({
    mutationFn: async () => {
      // The people endpoint saves the whole record, so send the current values alongside the new note.
      const response = await fetch(`/api/people/${person.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          name: personName(person), title: person.title, email: person.work_email ?? '', phone: person.phone_number ?? '', personalEmail: person.personal_email ?? '',
          address: person.address ?? '', department: person.department ?? '', level: person.level ?? '', startDate: person.start_date.slice(0, 10), notes,
        })
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the note.')
    },
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['person', person.id] }), queryClient.invalidateQueries({ queryKey: ['people'] })]),
  })
  const changed = notes.trim() !== (person.notes ?? '').trim()
  return <section className="flex flex-col gap-3">
    <h2 className="px-1 font-heading text-base font-semibold">Notes</h2>
    <Card className="gap-3 p-3">
      <Textarea
        aria-label={`Notes about ${personName(person)}`}
        className="border-transparent bg-muted shadow-none before:hidden [&_textarea]:min-h-24"
        placeholder={`Add a note about ${person.first_name}…`}
        rows={4}
        readOnly={!canWrite}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      {canWrite && <div className="flex flex-wrap items-center justify-end gap-3">
        {save.isError ? <p role="alert" className="mr-auto text-sm text-destructive">{save.error.message}</p> : null}
        <Button variant="outline" disabled={!changed} loading={save.isPending} onClick={() => save.mutate()}>Save note</Button>
      </div>}
    </Card>
  </section>
}

/** Right-hand card: label/value rows grouped under Work, Personal and Access. Empty values become "+ Add" actions. */
function DetailsCard({ person, manager, invitation, canWrite, canInvite, onInvite }: { person: Profile['person']; manager: string | null; invitation: Invitation; canWrite: boolean; canInvite: boolean; onInvite: () => void }) {
  return <Card className="gap-5  bg-transparent border-none p-5 lg:sticky lg:top-6">
    <DetailGroup title="Work">
      <DetailRow label="Joined"><span>{formatDate(person.start_date)}</span></DetailRow>
      <DetailRow label="Work email">{person.work_email ? <a className="truncate text-primary hover:underline" href={`mailto:${person.work_email}`}>{person.work_email}</a> : <AddAction canWrite={canWrite} personId={person.id} />}</DetailRow>
      <DetailRow label="Reports to">{manager ? <span className="truncate">{manager}</span> : <AddAction canWrite={canWrite} personId={person.id} text="Set manager" />}</DetailRow>
      <DetailRow label="Department">{person.department ? <span className="truncate">{person.department}</span> : <AddAction canWrite={canWrite} personId={person.id} />}</DetailRow>
      <DetailRow label="Level">{person.level ? <span className="truncate">{person.level}</span> : <AddAction canWrite={canWrite} personId={person.id} />}</DetailRow>
      <DetailRow label="Phone">{person.phone_number ? <span className="truncate">{person.phone_number}</span> : <AddAction canWrite={canWrite} personId={person.id} />}</DetailRow>
    </DetailGroup>
    <Separator />
    <DetailGroup title="Personal">
      <DetailRow label="Email">{person.personal_email ? <a className="truncate text-primary hover:underline" href={`mailto:${person.personal_email}`}>{person.personal_email}</a> : <AddAction canWrite={canWrite} personId={person.id} />}</DetailRow>
      <DetailRow label="Address">{person.address ? <span className="min-w-0 break-words">{person.address}</span> : <AddAction canWrite={canWrite} personId={person.id} />}</DetailRow>
    </DetailGroup>
    <Separator />
    <DetailGroup title="Access">
      <DetailRow label="Invitation">
        <span className="flex flex-wrap items-center gap-x-3">
          <span>{invitation === 'none' ? 'Not sent' : invitation === 'pending' ? 'Sent' : invitation === 'accepted' ? 'Accepted' : 'Expired'}</span>
          {canInvite && invitation !== 'accepted' && <button type="button" className="rounded-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-64" disabled={!person.personal_email} onClick={onInvite}>{invitation === 'none' ? 'Send' : 'Resend'}</button>}
        </span>
      </DetailRow>
    </DetailGroup>
  </Card>
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">
    <h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">{title}</h2>
    <dl className="flex flex-col gap-3 text-sm">{children}</dl>
  </div>
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid min-h-7 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="flex min-w-0 items-center">{children}</dd>
  </div>
}

function AddAction({ canWrite, personId, text = 'Add' }: { canWrite: boolean; personId: string; text?: string }) {
  if (!canWrite) return <span className="text-muted-foreground">Not added</span>
  // Plain text-style link to the edit page: no border or fill, just a hover colour change
  return <Link to="/dashboard/people/$personId/edit" params={{ personId }} className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground no-underline outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-4" aria-hidden="true" />{text}</Link>
}

/** Invite dialog (controlled): makes a one-time setup link for the person's personal email. */
function InvitePerson({ person, isOwner, open, onOpenChange }: { person: Profile['person']; isOwner: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState<'employee' | 'hr_admin'>('employee')
  const [copied, setCopied] = useState(false)
  const invite = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId: person.id, role }) })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) throw new Error(payload.error ?? 'Could not create invitation.')
      return payload.url
    },
    onSuccess: () => { appToast.success('Setup link created', { description: 'Copy it and send it to the person.' }); return queryClient.invalidateQueries({ queryKey: ['person', person.id] }) },
    onError: (error) => appToast.error('Setup link not created', error, 'Could not create the invitation.'),
  })
  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { invite.reset(); setCopied(false) } }}>
    <DialogPopup>
      <DialogHeader><DialogTitle>Invite {personName(person)}</DialogTitle><DialogDescription>Make a one-time setup link for {person.personal_email || 'their personal email'}. The link expires in 7 days.</DialogDescription></DialogHeader>
      <DialogPanel className="flex flex-col gap-4">
        <Field><FieldLabel>Access role</FieldLabel><NativeSelect className="w-full" value={role} onChange={(event) => setRole(event.target.value as 'employee' | 'hr_admin')}><NativeSelectOption value="employee">Employee</NativeSelectOption>{isOwner && <NativeSelectOption value="hr_admin">HR admin</NativeSelectOption>}</NativeSelect></Field>
        <p className="text-xs leading-5 text-muted-foreground">Their role controls which areas they can read or change. The owner can edit permissions in Settings.</p>
        {invite.data && <Field><FieldLabel>Setup link</FieldLabel><Input readOnly value={invite.data} onFocus={(event) => event.target.select()} /><Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(invite.data).then(() => { setCopied(true); appToast.info('Setup link copied') }).catch((error) => appToast.error('Link not copied', error, 'Could not copy the setup link.')) }}>{copied ? 'Copied' : 'Copy link'}</Button></Field>}
        {invite.isError && <p role="alert" className="text-sm text-destructive">{invite.error.message}</p>}
      </DialogPanel>
      <DialogFooter><DialogClose render={<Button variant="ghost" />}>Close</DialogClose><Button type="button" loading={invite.isPending} onClick={() => invite.mutate()}><UserRound data-icon="inline-start" />{invite.data ? 'Regenerate link' : 'Create link'}</Button></DialogFooter>
    </DialogPopup>
  </Dialog>
}

function RenameDocument({ personId, document }: { personId: string; document: Profile['documents'][number] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(document.display_name || document.file_name)
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/people/${personId}/files/${document.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not rename document.')
    }, onSuccess: () => { setOpen(false); void queryClient.invalidateQueries({ queryKey: ['person', personId] }); appToast.success('Document renamed') }, onError: (error) => appToast.error('Document not renamed', error, 'Could not rename the document.')
  })
  return <>
    <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Rename</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup>
        <DialogHeader><DialogTitle>Rename document</DialogTitle><DialogDescription>The file stays the same; only the name shown here changes.</DialogDescription></DialogHeader>
        <form className="contents" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
          <DialogPanel><Field><FieldLabel>Document name</FieldLabel><Input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></Field>{save.isError && <p role="alert" className="mt-3 text-sm text-destructive">{save.error.message}</p>}</DialogPanel>
          <DialogFooter><DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose><Button type="submit" loading={save.isPending}>Save name</Button></DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  </>
}

async function employmentAction(personId: string, body: object) {
  const response = await fetch(`/api/people/${personId}/employment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json() as { error?: string; reassigned?: number; cancelledLeave?: number; accessRemoved?: boolean; openPayments?: number }
  if (!response.ok) throw new Error(payload.error ?? 'Could not update this person.')
  return payload
}

const exitReasons = [
  { value: 'resigned', label: 'Resigned' },
  { value: 'let_go', label: 'Let go' },
  { value: 'contract_ended', label: 'Contract ended' },
  { value: 'internship_ended', label: 'Internship ended' },
  { value: 'other', label: 'Other' },
]

/** Ends someone's employment. Their records stay; they disappear from day-to-day views and lose sign-in access. */
function LetGoDialog({ person, onClose }: { person: Profile['person']; onClose: () => void }) {
  const queryClient = useQueryClient()
  const people = useQuery(peopleQueryOptions)
  const today = new Date().toISOString().slice(0, 10)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState(/intern/i.test(person.title) ? 'internship_ended' : 'resigned')
  const [note, setNote] = useState('')
  const reports = (people.data ?? []).filter((item) => item.manager_employment_id === person.employment_id)
  const others = (people.data ?? []).filter((item) => item.employment_id !== person.employment_id)
  const [reassignTo, setReassignTo] = useState(person.manager_employment_id ?? '')
  const name = personName(person)
  const end = useMutation({
    mutationFn: () => employmentAction(person.id, { action: 'end', endDate, reason, note, reassignTo: reassignTo || null }),
    onSuccess: async () => {
      await Promise.all(['person', 'people', 'time-off', 'overview', 'payments'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      onClose()
      appToast.warning('Employment ended', { description: `${name}'s history has been retained.` })
    },
    onError: (error) => appToast.error('Employment not ended', error, 'Could not update this person.'),
  })
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Let {person.first_name} go</DialogTitle>
          <DialogDescription>{name}’s record, pay history and documents are kept. They are hidden from People, the calendar and new payments, and can be rehired later.</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={(event) => { event.preventDefault(); end.mutate() }}>
          <DialogPanel className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">Last working day<Input required type="date" min={person.start_date} max={today} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">Reason
                <NativeSelect value={reason} onChange={(event) => setReason(event.target.value)}>
                  {exitReasons.map((item) => <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>)}
                </NativeSelect>
              </label>
            </div>
            {reports.length > 0 && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {reports.length} {reports.length === 1 ? 'person reports' : 'people report'} to {person.first_name}. Move them to
                <NativeSelect value={reassignTo} onChange={(event) => setReassignTo(event.target.value)}>
                  <NativeSelectOption value="">No manager</NativeSelectOption>
                  {others.map((item) => <NativeSelectOption key={item.employment_id} value={item.employment_id}>{personName(item)}</NativeSelectOption>)}
                </NativeSelect>
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium">Note<Textarea value={note} placeholder="Optional, for HR only. e.g. Notice period served, laptop returned." onChange={(event) => setNote(event.target.value)} /></label>
            <ul className="flex list-disc flex-col gap-1 rounded-lg bg-muted/60 py-2.5 pr-3 pl-7 text-xs leading-5 text-muted-foreground">
              <li>Their sign-in stops working for this workspace right away.</li>
              <li>Leave waiting for approval, and approved leave after the last day, is cancelled.</li>
              <li>Draft and scheduled payments stay, so you can still pay a final settlement.</li>
            </ul>
            {end.isError && <p className="text-sm text-destructive">{end.error.message}</p>}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" loading={end.isPending}>Let {person.first_name} go</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

/** The only place a person's records are removed for good. Owner only, and only after they have left. */
function DeletePersonDialog({ person, onClose }: { person: Profile['person']; onClose: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const name = personName(person)
  const [confirm, setConfirm] = useState('')
  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/people/${person.id}/employment`, { method: 'DELETE' })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not delete this record.')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      queryClient.removeQueries({ queryKey: ['person', person.id] })
      appToast.warning('Person deleted', { description: 'Their profile and related records were removed.' })
      await navigate({ to: '/dashboard/people' })
    },
    onError: (error) => appToast.error('Person not deleted', error, 'Could not delete this record.'),
  })
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Delete {name} permanently?</DialogTitle>
          <DialogDescription>This removes their profile, leave, payments, compensation and uploaded documents. It can’t be undone. Company expenses they logged stay, without their name.</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={(event) => { event.preventDefault(); remove.mutate() }}>
          <DialogPanel className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">Type <span className="font-semibold">{name}</span> to confirm<Input value={confirm} autoComplete="off" onChange={(event) => setConfirm(event.target.value)} /></label>
            {remove.isError && <p className="text-sm text-destructive">{remove.error.message}</p>}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={confirm.trim() !== name} loading={remove.isPending}><Trash2 data-icon="inline-start" />Delete permanently</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
