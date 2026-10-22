import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import { DashboardPage } from '#/components/dashboard-page'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#/components/ui/breadcrumb'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { useWorkspace } from '#/lib/workspace-client'
import { HandbookContent } from '#/components/handbook-content'

const HandbookEditor = lazy(() => import('#/components/handbook-editor').then((module) => ({ default: module.HandbookEditor })))
type Doc = { id: string; title: string; slug: string; kind: string; visibility: string; status: string; content: JSONContent }
async function getDoc(id: string) {
  const response = await fetch(`/api/docs/${id}`)
  const payload = await response.json() as { document?: Doc; companySlug?: string; error?: string }
  if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not load document.')
  return { document: payload.document, companySlug: payload.companySlug }
}
export const Route = createFileRoute('/dashboard/docs/$documentId')({ component: DocumentPage })

function DocumentPage() {
  const { documentId } = Route.useParams()
  const query = useQuery({ queryKey: ['handbook-doc', documentId], queryFn: () => getDoc(documentId), staleTime: 30_000 })
  const workspace = useWorkspace(true)
  return <DashboardPage title="Docs" showHeading={false}>
    <Breadcrumb className="mb-10"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink render={<Link to="/dashboard/docs" />}>Docs</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="max-w-80 truncate">{query.data?.document.title ?? 'Document'}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    {query.isPending && <p className="text-sm text-muted-foreground">Loading document…</p>}
    {query.isError && <p className="text-sm text-destructive">{query.error.message}</p>}
    {query.data && (workspace.data?.permissions.docs.write ? <DocumentEditor key={query.data.document.id} initial={query.data.document} companySlug={query.data.companySlug} /> : <div className="mx-auto max-w-3xl"><h1 className="mb-8 text-4xl font-semibold tracking-[-0.045em] text-balance">{query.data.document.title}</h1><HandbookContent content={query.data.document.content} /></div>)}
  </DashboardPage>
}

function DocumentEditor({ initial, companySlug }: { initial: Doc; companySlug?: string }) {
  const documentId = initial.id
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initial.title)
  const [kind, setKind] = useState(initial.kind)
  const [visibility, setVisibility] = useState(initial.visibility)
  const [status, setStatus] = useState(initial.status)
  const [content, setContent] = useState<JSONContent>(initial.content)
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async (nextStatus: string) => {
      const response = await fetch(`/api/docs/${documentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, kind, visibility, status: nextStatus, content }) })
      const payload = await response.json() as { document?: Doc; error?: string }
      if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not save document.')
      return payload.document
    },
    onSuccess: (document) => {
      setStatus(document.status); setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['handbook-docs'] })
      queryClient.setQueryData(['handbook-doc', documentId], (old: { document: Doc; companySlug?: string } | undefined) => old ? { ...old, document } : old)
    },
  })
  const publicUrl = companySlug ? `/handbook/${companySlug}/${initial.slug}` : null
  const canSharePublicly = status === 'published' && visibility === 'public' && !dirty && Boolean(publicUrl)
  async function copyPublicLink() {
    if (!publicUrl || !canSharePublicly) return
    try {
      await navigator.clipboard.writeText(new URL(publicUrl, window.location.origin).toString())
      setCopied(true)
      setShareError(null)
    } catch {
      setShareError('Could not copy the link. Open the public page and copy its address instead.')
    }
  }
  return <div className="mx-auto max-w-3xl">
      <Input aria-label="Document title" className="mb-6 h-auto w-full border-0 bg-transparent px-0 text-4xl font-semibold tracking-[-0.045em] shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 sm:text-5xl" value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true) }} placeholder="Untitled" />
      <div className="mb-8 flex flex-wrap items-center gap-2 border-b pb-5">
        <span className="mr-auto text-xs text-muted-foreground">{status === 'published' ? 'Published' : 'Draft'}{dirty ? ' · Unsaved changes' : ' · Saved'}</span>
        <Button variant="outline" onClick={() => save.mutate(status)} loading={save.isPending}>Save</Button>
        <Button onClick={() => save.mutate(status === 'published' ? 'draft' : 'published')} loading={save.isPending}>{status === 'published' ? 'Unpublish' : 'Publish'}</Button>
        <Dialog><DialogTrigger render={<Button variant="outline" />}><Share2 data-icon="inline-start" />Share</DialogTrigger><DialogPopup><DialogHeader><DialogTitle>Share document</DialogTitle><DialogDescription>Choose who can open this document. Public sharing requires a published, saved document.</DialogDescription></DialogHeader><DialogPanel className="flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">Who can access<NativeSelect className="w-full" value={visibility} onChange={(event) => { setVisibility(event.target.value); setDirty(true); setCopied(false) }}><NativeSelectOption value="private">People with Docs access</NativeSelectOption><NativeSelectOption value="public">Anyone with the link</NativeSelectOption></NativeSelect></label><p className="text-sm text-muted-foreground">{visibility === 'public' ? 'Publish and save this document to create a public page.' : 'This document stays inside your workspace, including when published.'}</p>{canSharePublicly && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { void copyPublicLink() }}>{copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copied ? 'Copied link' : 'Copy public link'}</Button><Button variant="ghost" render={<a href={publicUrl ?? '#'} target="_blank" rel="noreferrer" />}><ExternalLink data-icon="inline-start" />Open page</Button></div>}{visibility === 'public' && !canSharePublicly && <p className="text-xs text-muted-foreground">Save {status !== 'published' ? 'and publish ' : ''}your changes to enable the link.</p>}{shareError && <p role="alert" className="text-sm text-destructive">{shareError}</p>}</DialogPanel><DialogFooter><DialogClose render={<Button variant="outline" />}>Done</DialogClose></DialogFooter></DialogPopup></Dialog>
      </div>
      {save.isError && <p className="mb-4 text-sm text-destructive">{save.error.message}</p>}
      <Suspense fallback={<div className="rounded-lg border p-8 text-sm text-muted-foreground">Loading editor…</div>}><HandbookEditor key={documentId} content={content} onChange={(next) => { setContent(next); setDirty(true) }} /></Suspense>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-5 text-xs text-muted-foreground"><p>Type / for blocks. Changes are saved when you select Save.</p><label className="flex items-center gap-2">Document type<NativeSelect value={kind} onChange={(event) => { setKind(event.target.value); setDirty(true) }}><NativeSelectOption value="general">Document</NativeSelectOption><NativeSelectOption value="policy">Policy</NativeSelectOption><NativeSelectOption value="sop">SOP</NativeSelectOption><NativeSelectOption value="guide">Guide</NativeSelectOption></NativeSelect></label></div>
    </div>
}
