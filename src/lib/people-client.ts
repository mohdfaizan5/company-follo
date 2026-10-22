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
