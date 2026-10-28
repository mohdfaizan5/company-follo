export type Person = {
  id: string
  employment_id: string
  first_name: string
  last_name: string | null
  title: string
  work_email: string | null
  phone_number: string | null
  start_date: string
  department: string | null
  level: string | null
  manager_employment_id: string | null
  avatar_url?: string | null
  /** Leave category covering today: paid / unpaid leave or wfh. Null when the person is in. */
  today_status?: 'paid' | 'unpaid' | 'wfh' | null
  /** Workspace access: their role once they accepted an invitation, `invited` while one is pending, null otherwise. */
  access?: 'owner' | 'hr_admin' | 'employee' | 'invited' | null
  end_date?: string | null
  end_reason?: string | null
}

export function personName(person: Pick<Person, 'first_name' | 'last_name'>) {
  return `${person.first_name} ${person.last_name ?? ''}`.trim()
}

export async function getPeople() {
  const response = await fetch('/api/people')
  const payload = await response.json() as { people?: Person[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load people.')
  return payload.people ?? []
}

export const peopleQueryOptions = {
  queryKey: ['people'] as const,
  queryFn: getPeople,
  staleTime: 60_000,
}

/** People whose employment has ended. Their records are kept but hidden everywhere else. */
export const formerPeopleQueryOptions = {
  queryKey: ['people', 'former'] as const,
  queryFn: async () => {
    const response = await fetch('/api/people?status=former')
    const payload = await response.json() as { people?: Person[]; error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'Could not load former people.')
    return payload.people ?? []
  },
  staleTime: 60_000,
}

export type Invitation = 'none' | 'pending' | 'accepted' | 'expired'

export type PersonProfile = {
  person: {
    id: string; first_name: string; last_name: string | null; work_email: string | null; phone_number: string | null; personal_email: string | null; address: string | null; avatar_url: string | null;
    notes: string | null; title: string; department: string | null; level: string | null; start_date: string;
    employment_id: string; manager_employment_id: string | null;
    status: string; end_date: string | null; end_reason: string | null; exit_note: string | null;
    manager_first_name: string | null; manager_last_name: string | null; company_name: string
  }
  invitation: Invitation
  compensation: { id: string; kind: string; amount: string; currency: 'INR' | 'USD'; effective_from: string }[]
  payments: { id: string; amount: string; currency: 'INR' | 'USD'; status: string; paid_on: string | null; created_at: string }[]
  expenses: { id: string; label: string; amount: string; currency: 'INR' | 'USD'; incurred_on: string }[]
  documents: { id: string; file_name: string; display_name: string | null; kind: string }[]
  uploadsEnabled: boolean
  canWritePeople: boolean
  payrollAllowed: boolean
  expensesAllowed: boolean
}

export async function getPersonProfile(personId: string) {
  const response = await fetch(`/api/people/${personId}`)
  const payload = await response.json() as PersonProfile & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load this person.')
  return payload
}
