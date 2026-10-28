import { useQuery } from '@tanstack/react-query'

export type Workspace = {
  organization_id: string
  organization_name: string
  company_id: string
  company_name: string
  default_currency: 'INR' | 'USD'
  /** 0 = Sunday … 6 = Saturday */
  working_days: number[]
  logo_url?: string | null
  role: 'owner' | 'hr_admin' | 'employee'
  permissions: Record<
    | 'overview'
    | 'people'
    | 'calendar'
    | 'docs'
    | 'payroll'
    | 'expenses'
    | 'agent',
    { read: boolean; write: boolean }
  >
}

export async function getWorkspace() {
  const response = await fetch('/api/workspace')
  const payload = (await response.json()) as {
    workspace?: Workspace | null
    error?: string
  }
  if (!response.ok)
    throw new Error(payload.error ?? 'Could not load workspace.')
  return payload.workspace ?? null
}

export const workspaceQueryOptions = {
  queryKey: ['workspace'] as const,
  queryFn: getWorkspace,
  staleTime: 5 * 60_000,
}

export function useWorkspace(enabled: boolean) {
  return useQuery({ ...workspaceQueryOptions, enabled })
}
