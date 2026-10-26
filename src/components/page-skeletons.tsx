import { Skeleton } from '#/components/ui/skeleton'

export type PageSkeletonKind = 'cards' | 'table' | 'calendar' | 'doc' | 'profile' | 'form'

export function CardsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="mt-7 h-64 rounded-xl" />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="rounded-xl border">
      <div className="flex gap-4 border-b px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <div className="rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}

export function DocSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-3xl">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-4 h-4 w-40" />
      <div className="mt-10 flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-6 h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export function PageSkeleton({ kind = 'cards' }: { kind?: PageSkeletonKind }) {
  if (kind === 'table') return <TableSkeleton />
  if (kind === 'calendar') return <CalendarSkeleton />
  if (kind === 'doc') return <DocSkeleton />
  if (kind === 'profile') return <ProfileSkeleton />
  if (kind === 'form') return <FormSkeleton />
  return <CardsSkeleton />
}
