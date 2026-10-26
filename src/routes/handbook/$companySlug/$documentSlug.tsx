import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/core'
import { HandbookContent } from '#/components/handbook-content'
import { DocSkeleton } from '#/components/page-skeletons'

const kindLabels: Record<string, string> = { general: 'Document', policy: 'Policy', sop: 'SOP', guide: 'Guide' }

export const Route = createFileRoute('/handbook/$companySlug/$documentSlug')({ component: PublicDocument })
function PublicDocument() {
  const { companySlug, documentSlug } = Route.useParams()
  const query = useQuery({ queryKey: ['public-document', companySlug, documentSlug], queryFn: async () => {
    const response = await fetch(`/api/handbook/${encodeURIComponent(companySlug)}/${encodeURIComponent(documentSlug)}`)
    const payload = await response.json() as { document?: { title: string; kind: string; content: JSONContent; company_name: string; updated_at: string }; error?: string }
    if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not load this page.')
    return payload.document
  }, staleTime: 60_000 })
  return <main className="mx-auto min-h-svh max-w-3xl px-6 py-12 sm:py-20">
    {query.isPending && <DocSkeleton />}
    {query.isError && <p className="text-sm text-muted-foreground">{query.error.message}</p>}
    {query.data && <><div className="mb-10"><p className="mb-3 text-sm text-muted-foreground">{query.data.company_name} · {kindLabels[query.data.kind] ?? 'Document'} · Updated {new Date(query.data.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{query.data.title}</h1></div><HandbookContent content={query.data.content} /></>}
  </main>
}
