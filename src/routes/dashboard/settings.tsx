import { createFileRoute } from '@tanstack/react-router'
import { Building2, CalendarDays, ShieldCheck } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardPage } from '#/components/dashboard-page'
import { TableSkeleton } from '#/components/page-skeletons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'
import { Checkbox } from '#/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { CompanyLogoUpload } from '#/components/employee-uploads'
import { appToast } from '#/lib/toast'

type PermissionRule = { role: 'hr_admin' | 'employee'; resource: 'overview' | 'people' | 'calendar' | 'docs' | 'payroll' | 'expenses'; read: boolean; write: boolean }
const resources = [
  { key: 'overview', label: 'Overview', detail: 'Company summary' },
  { key: 'people', label: 'People', detail: 'Profiles, contacts and uploaded documents' },
  { key: 'calendar', label: 'Calendar', detail: 'Holidays, leave and balances' },
  { key: 'docs', label: 'Docs', detail: 'Company rules and SOPs' },
  { key: 'payroll', label: 'Payroll', detail: 'Payments and compensation' },
  { key: 'expenses', label: 'Expenses', detail: 'Expenses on people profiles' },
] as const

export const Route = createFileRoute('/dashboard/settings')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    await context.queryClient.ensureQueryData(workspaceQueryOptions)
  },
  component: Settings,
})

function Settings() {
  return <DashboardPage title="Settings" description="The company and access details behind your workspace." skeleton="form"><SettingsContent /></DashboardPage>
}

function SettingsContent() {
  const { data: workspace } = useWorkspace(true)
  if (!workspace) return null
  return <><div className="grid gap-4 md:grid-cols-2">
    <Card><CardHeader><Building2 className="size-5 text-muted-foreground" /><CardTitle className="mt-3">Company</CardTitle><CardDescription>Your current company details.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5"><CompanyLogoUpload logoUrl={workspace.logo_url} companyName={workspace.company_name} canEdit={workspace.role !== 'employee'} /><dl className="grid gap-3 text-sm"><Setting label="Organization" value={workspace.organization_name} /><Setting label="Company" value={workspace.company_name} /><Setting label="Default currency" value={workspace.default_currency} /></dl></CardContent></Card>
    <Card><CardHeader><ShieldCheck className="size-5 text-muted-foreground" /><CardTitle className="mt-3">Your access</CardTitle><CardDescription>Permissions for this workspace.</CardDescription></CardHeader><CardContent><Setting label="Role" value={workspace.role === 'hr_admin' ? 'HR admin' : workspace.role === 'owner' ? 'Owner' : 'Employee'} /></CardContent></Card>
  </div>{workspace.role !== 'employee' && <WorkWeek workingDays={workspace.working_days} />}{workspace.role === 'owner' && <PermissionMatrix />}</>
}

const weekdays = [
  { value: '1', label: 'Mon' }, { value: '2', label: 'Tue' }, { value: '3', label: 'Wed' }, { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' }, { value: '6', label: 'Sat' }, { value: '0', label: 'Sun' },
]

function WorkWeek({ workingDays }: { workingDays: number[] }) {
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: async (days: number[]) => {
      const response = await fetch('/api/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workingDays: days }) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save working days.')
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['workspace'] }); void queryClient.invalidateQueries({ queryKey: ['time-off'] }); appToast.success('Work week saved') },
    onError: (error) => appToast.error('Work week not saved', error, 'Could not save working days.'),
  })
  const offDays = weekdays.filter((day) => !workingDays.includes(Number(day.value))).map((day) => day.label)
  return <Card className="mt-5"><CardHeader><CalendarDays className="size-5 text-muted-foreground" /><CardTitle className="mt-3">Work week</CardTitle><CardDescription>Leave is only counted on working days. Days off are greyed out in the calendar.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">
    <ToggleGroup multiple variant="outline" value={workingDays.map(String)} disabled={save.isPending} onValueChange={(value) => { if (value.length) save.mutate(value.map(Number)) }} aria-label="Working days">
      {weekdays.map((day) => <ToggleGroupItem key={day.value} value={day.value} className="w-12">{day.label}</ToggleGroupItem>)}
    </ToggleGroup>
    <p className="text-sm text-muted-foreground">{offDays.length ? `${offDays.join(', ')} ${offDays.length === 1 ? 'is a' : 'are'} weekly day${offDays.length === 1 ? '' : 's'} off.` : 'Every day is a working day.'}</p>
    {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
  </CardContent></Card>
}

function PermissionMatrix() {
  const queryClient = useQueryClient()
  const rules = useQuery({ queryKey: ['permissions'], queryFn: async () => {
    const response = await fetch('/api/permissions')
    const payload = await response.json() as { rules?: PermissionRule[]; error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'Could not load permissions.')
    return payload.rules ?? []
  } })
  const save = useMutation({ mutationFn: async (rule: PermissionRule) => {
    const response = await fetch('/api/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) })
    const payload = await response.json() as { error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'Could not save permission.')
  }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['permissions'] }); void queryClient.invalidateQueries({ queryKey: ['workspace'] }); appToast.success('Permission updated') }, onError: (error) => appToast.error('Permission not saved', error, 'Could not save permission.') })
  function toggle(rule: PermissionRule, action: 'read' | 'write', checked: boolean) {
    save.mutate({ ...rule, read: action === 'write' && checked ? true : action === 'read' ? checked : rule.read, write: action === 'read' && !checked ? false : action === 'write' ? checked : rule.write })
  }
  return <Card className="mt-5"><CardHeader><CardTitle>Permissions</CardTitle><CardDescription>Choose what HR admins and employees can read or change. Owner access is always full. Changes are checked by the server.</CardDescription></CardHeader><CardContent>{rules.isPending && <TableSkeleton rows={6} />}{rules.isError && <p className="text-sm text-destructive">{rules.error.message}</p>}{save.isError && <p role="alert" className="mb-3 text-sm text-destructive">{save.error.message}</p>}{rules.data && <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="pb-3 font-medium">Area</th><th className="pb-3 text-center font-medium" colSpan={2}>HR admin</th><th className="pb-3 text-center font-medium" colSpan={2}>Employee</th></tr><tr className="border-b text-xs text-muted-foreground"><th className="pb-2" /><th className="pb-2 text-center font-medium">Read</th><th className="pb-2 text-center font-medium">Write</th><th className="pb-2 text-center font-medium">Read</th><th className="pb-2 text-center font-medium">Write</th></tr></thead><tbody>{resources.map((resource) => <tr key={resource.key} className="border-b last:border-0"><th scope="row" className="py-3 pr-4 font-medium">{resource.label}<span className="block text-xs font-normal text-muted-foreground">{resource.detail}</span></th>{(['hr_admin', 'employee'] as const).flatMap((role) => {
    const rule = rules.data.find((item) => item.resource === resource.key && item.role === role)
    if (!rule) return []
    return (['read', 'write'] as const).map((action) => <td key={`${role}-${action}`} className="py-3 text-center"><Checkbox aria-label={`${role === 'hr_admin' ? 'HR admin' : 'Employee'} can ${action} ${resource.label}`} checked={rule[action]} disabled={save.isPending} onCheckedChange={(value) => toggle(rule, action, value === true)} /></td>)
  })}</tr>)}</tbody></table></div>}<p className="mt-4 text-xs text-muted-foreground">To create payments, a role also needs People read access to choose an employee. Employee access starts restricted until you grant it.</p></CardContent></Card>
}

function Setting({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
}
