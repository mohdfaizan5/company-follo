import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { Button } from '#/components/ui/button'
import { useWorkspace } from '#/lib/workspace-client'

type Doc = { id: string; title: string; kind: string; visibility: string; status: string; updated_at: string }
async function getDocs() {
  const response = await fetch('/api/docs')
  const payload = await response.json() as { documents?: Doc[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load documents.')
  return payload.documents ?? []
}

export const Route = createFileRoute('/dashboard/docs/')({ component: DocsPage })

function DocsPage() {
  const docs = useQuery({ queryKey: ['handbook-docs'], queryFn: getDocs, staleTime: 30_000 })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const workspace = useWorkspace(true)
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Untitled' }) })
      const payload = await response.json() as { document?: { id: string }; error?: string }
      if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not create document.')
      return payload.document
    },
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: ['handbook-docs'] })
      await navigate({ to: '/dashboard/docs/$documentId', params: { documentId: document.id } })
    },
  })
  return <DashboardPage title="Docs" description="Rules, SOPs and shared knowledge for your company." actions={workspace.data?.permissions.docs.write ? <Button onClick={() => create.mutate()} loading={create.isPending}><Plus data-icon="inline-start" />New document</Button> : undefined}>
    {create.isError && <p className="mb-4 text-sm text-destructive">{create.error.message}</p>}
    {docs.isPending && <p className="text-sm text-muted-foreground">Loading documents…</p>}
    {docs.isError && <p className="text-sm text-destructive">{docs.error.message}</p>}
    {docs.data?.length === 0 && <div className="rounded-lg border border-dashed p-10 text-center"><FileText className="mx-auto mb-3 size-6 text-muted-foreground" /><p className="font-medium">No documents yet</p><p className="mt-1 text-sm text-muted-foreground">Write your first policy, SOP or guide.</p></div>}
    {docs.data && docs.data.length > 0 && <div className="divide-y rounded-lg border">{docs.data.map((doc) => <Link key={doc.id} to="/dashboard/docs/$documentId" params={{ documentId: doc.id }} className="flex items-center gap-3 px-4 py-4 no-underline transition-colors hover:bg-accent"><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{doc.title}</span><span className="text-xs text-muted-foreground">{doc.kind === 'general' ? 'Document' : doc.kind.toUpperCase()} · {doc.status !== 'published' ? 'Draft' : doc.visibility === 'public' ? 'Public link' : 'Workspace only'}</span></span><span className="text-xs text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString()}</span></Link>)}</div>}
  </DashboardPage>
}
