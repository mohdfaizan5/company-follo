import { createFileRoute } from '@tanstack/react-router'
import { Building2, ShieldCheck } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardPage } from '#/components/dashboard-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { useWorkspace, workspaceQueryOptions } from '#/lib/workspace-client'
import { Checkbox } from '#/components/ui/checkbox'

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
  return <DashboardPage title="Settings" description="The company and access details behind your workspace."><SettingsContent /></DashboardPage>
}

function SettingsContent() {
  const { data: workspace } = useWorkspace(true)
  if (!workspace) return null
  return <><div className="grid gap-4 md:grid-cols-2">
    <Card><CardHeader><Building2 className="size-5 text-muted-foreground" /><CardTitle className="mt-3">Company</CardTitle><CardDescription>Your current company details.</CardDescription></CardHeader><CardContent><dl className="grid gap-3 text-sm"><Setting label="Organization" value={workspace.organization_name} /><Setting label="Company" value={workspace.company_name} /><Setting label="Default currency" value={workspace.default_currency} /></dl></CardContent></Card>
    <Card><CardHeader><ShieldCheck className="size-5 text-muted-foreground" /><CardTitle className="mt-3">Your access</CardTitle><CardDescription>Permissions for this workspace.</CardDescription></CardHeader><CardContent><Setting label="Role" value={workspace.role === 'hr_admin' ? 'HR admin' : workspace.role === 'owner' ? 'Owner' : 'Employee'} /></CardContent></Card>
  </div>{workspace.role === 'owner' && <PermissionMatrix />}</>
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
  }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['permissions'] }); void queryClient.invalidateQueries({ queryKey: ['workspace'] }) } })
  function toggle(rule: PermissionRule, action: 'read' | 'write', checked: boolean) {
    save.mutate({ ...rule, read: action === 'write' && checked ? true : action === 'read' ? checked : rule.read, write: action === 'read' && !checked ? false : action === 'write' ? checked : rule.write })
  }
  return <Card className="mt-5"><CardHeader><CardTitle>Permissions</CardTitle><CardDescription>Choose what HR admins and employees can read or change. Owner access is always full. Changes are checked by the server.</CardDescription></CardHeader><CardContent>{rules.isPending && <p className="text-sm text-muted-foreground">Loading access rules…</p>}{rules.isError && <p className="text-sm text-destructive">{rules.error.message}</p>}{save.isError && <p role="alert" className="mb-3 text-sm text-destructive">{save.error.message}</p>}{rules.data && <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="pb-3 font-medium">Area</th><th className="pb-3 text-center font-medium" colSpan={2}>HR admin</th><th className="pb-3 text-center font-medium" colSpan={2}>Employee</th></tr><tr className="border-b text-xs text-muted-foreground"><th className="pb-2" /><th className="pb-2 text-center font-medium">Read</th><th className="pb-2 text-center font-medium">Write</th><th className="pb-2 text-center font-medium">Read</th><th className="pb-2 text-center font-medium">Write</th></tr></thead><tbody>{resources.map((resource) => <tr key={resource.key} className="border-b last:border-0"><th scope="row" className="py-3 pr-4 font-medium">{resource.label}<span className="block text-xs font-normal text-muted-foreground">{resource.detail}</span></th>{(['hr_admin', 'employee'] as const).flatMap((role) => {
    const rule = rules.data.find((item) => item.resource === resource.key && item.role === role)
    if (!rule) return []
    return (['read', 'write'] as const).map((action) => <td key={`${role}-${action}`} className="py-3 text-center"><Checkbox aria-label={`${role === 'hr_admin' ? 'HR admin' : 'Employee'} can ${action} ${resource.label}`} checked={rule[action]} disabled={save.isPending} onCheckedChange={(value) => toggle(rule, action, value === true)} /></td>)
  })}</tr>)}</tbody></table></div>}<p className="mt-4 text-xs text-muted-foreground">To create payments, a role also needs People read access to choose an employee. Employee access starts restricted until you grant it.</p></CardContent></Card>
}

function Setting({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
}
