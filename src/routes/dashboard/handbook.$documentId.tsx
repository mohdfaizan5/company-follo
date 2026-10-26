import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/core'
import { DashboardPage } from '#/components/dashboard-page'
import { HandbookContent } from '#/components/handbook-content'
import { DocSkeleton } from '#/components/page-skeletons'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#/components/ui/breadcrumb'

type Doc = { id: string; title: string; kind: string; content: JSONContent; updated_at: string }

/** Read-only view of a published company doc, open to every member. */
export const Route = createFileRoute('/dashboard/handbook/$documentId')({ component: HandbookPage })

function HandbookPage() {
  const { documentId } = Route.useParams()
  const query = useQuery({
    queryKey: ['my-doc', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/my-docs/${documentId}`)
      const payload = await response.json() as { document?: Doc; error?: string }
      if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not load this document.')
      return payload.document
    },
    staleTime: 60_000,
  })
  return (
    <DashboardPage title="Document" showHeading={false} skeleton="doc">
      <div className="mx-auto max-w-3xl">
        <Breadcrumb className="mb-10"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink render={<Link to="/dashboard/me" />}>My space</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="max-w-60 truncate">{query.data?.title ?? 'Document'}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
        {query.isPending && <DocSkeleton />}
        {query.isError && <p className="text-sm text-destructive">{query.error.message}</p>}
        {query.data && <>
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-balance">{query.data.title}</h1>
          <p className="mt-3 mb-10 text-sm text-muted-foreground">Updated {new Date(query.data.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <HandbookContent content={query.data.content} />
        </>}
      </div>
    </DashboardPage>
  )
}
