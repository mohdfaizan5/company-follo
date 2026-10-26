import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Globe, Lock, Share2 } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import { DashboardPage } from '#/components/dashboard-page'
import { DocSkeleton } from '#/components/page-skeletons'
import { Button } from '#/components/ui/button'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#/components/ui/breadcrumb'
import { Dialog, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import { useWorkspace } from '#/lib/workspace-client'
import { HandbookContent } from '#/components/handbook-content'

const HandbookEditor = lazy(() => import('#/components/handbook-editor').then((module) => ({ default: module.HandbookEditor })))
type Doc = { id: string; title: string; slug: string; kind: string; visibility: string; status: string; content: JSONContent; updated_at?: string }
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
  return <DashboardPage title="Docs" showHeading={false} skeleton="doc">
    {query.isPending && <DocSkeleton />}
    {query.isError && <p className="text-sm text-destructive">{query.error.message}</p>}
    {query.data && (workspace.data?.permissions.docs.write
      ? <DocumentEditor key={query.data.document.id} initial={query.data.document} companySlug={query.data.companySlug} />
      : <div className="mx-auto max-w-3xl"><DocBreadcrumb title={query.data.document.title} /><h1 className="mb-8 text-4xl font-semibold tracking-[-0.045em] text-balance">{query.data.document.title}</h1><HandbookContent content={query.data.document.content} /></div>)}
  </DashboardPage>
}

function DocBreadcrumb({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="mb-10 flex min-h-8 flex-wrap items-center justify-between gap-3">
    <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink render={<Link to="/dashboard/docs" />}>Docs</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="max-w-60 truncate">{title || 'Untitled'}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    {children}
  </div>
}

type Draft = { title: string; kind: string; visibility: string; status: string; content: JSONContent }

/** Edits save automatically a moment after you stop typing; Publish only changes who can read it. */
function DocumentEditor({ initial, companySlug }: { initial: Doc; companySlug?: string }) {
  const documentId = initial.id
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>({ title: initial.title === 'Untitled' ? '' : initial.title, kind: initial.kind, visibility: initial.visibility, status: initial.status, content: initial.content })
  const [dirty, setDirty] = useState(false)
  const latest = useRef(draft)
  latest.current = draft
  const save = useMutation({
    mutationFn: async (next: Draft) => {
      const response = await fetch(`/api/docs/${documentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...next, title: next.title.trim() || 'Untitled' }) })
      const payload = await response.json() as { document?: Doc; error?: string }
      if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not save document.')
      return payload.document
    },
    onSuccess: (document, sent) => {
      if (latest.current === sent) setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['handbook-docs'] })
      queryClient.setQueryData(['handbook-doc', documentId], (old: { document: Doc; companySlug?: string } | undefined) => old ? { ...old, document } : old)
    },
  })

  function update(patch: Partial<Draft>, immediate = false) {
    const next = { ...latest.current, ...patch }
    setDraft(next)
    setDirty(true)
    if (immediate) save.mutate(next)
  }

  // Autosave typing after a short pause.
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => save.mutate(latest.current), 900)
    return () => window.clearTimeout(timer)
  }, [draft, dirty])

  const published = draft.status === 'published'
  const state = save.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : save.isError ? 'Not saved' : 'Saved'

  return <div className="mx-auto max-w-3xl">
    <DocBreadcrumb title={draft.title}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground" aria-live="polite">{published ? 'Published' : 'Draft'} · {state}</span>
        <ShareDialog draft={draft} slug={initial.slug} companySlug={companySlug} saved={!dirty && !save.isPending} onVisibility={(visibility) => update({ visibility }, true)} />
        <Button size="sm" variant={published ? 'outline' : 'default'} onClick={() => update({ status: published ? 'draft' : 'published' }, true)}>{published ? 'Unpublish' : 'Publish'}</Button>
      </div>
    </DocBreadcrumb>
    <textarea
      aria-label="Document title"
      rows={1}
      value={draft.title}
      placeholder="Untitled"
      onChange={(event) => update({ title: event.target.value.replace(/\n/g, ' ') })}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      className="field-sizing-content w-full resize-none overflow-hidden bg-transparent py-1 text-4xl leading-tight font-semibold tracking-[-0.045em] text-balance outline-none placeholder:text-muted-foreground/48 sm:text-5xl"
    />
    <div className="mt-3 mb-8 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Type</span>
      <NativeSelect size="sm" className="w-auto" value={draft.kind} onChange={(event) => update({ kind: event.target.value }, true)} aria-label="Document type">
        <NativeSelectOption value="general">Document</NativeSelectOption>
        <NativeSelectOption value="policy">Policy</NativeSelectOption>
        <NativeSelectOption value="sop">SOP</NativeSelectOption>
        <NativeSelectOption value="guide">Guide</NativeSelectOption>
      </NativeSelect>
    </div>
    {save.isError && <p role="alert" className="mb-4 text-sm text-destructive">{save.error.message}</p>}
    <Suspense fallback={<div className="flex flex-col gap-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>}>
      <HandbookEditor key={documentId} content={draft.content} onChange={(content) => update({ content })} />
    </Suspense>
  </div>
}

function ShareDialog({ draft, slug, companySlug, saved, onVisibility }: { draft: Draft; slug: string; companySlug?: string; saved: boolean; onVisibility: (visibility: string) => void }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPublic = draft.visibility === 'public'
  const publicUrl = companySlug ? `/handbook/${companySlug}/${slug}` : null
  const linkLive = isPublic && draft.status === 'published' && saved && Boolean(publicUrl)
  async function copy() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(new URL(publicUrl, window.location.origin).toString())
      setCopied(true)
      setError(null)
    } catch {
      setError('Could not copy. Open the page and copy its address instead.')
    }
  }
  return <Dialog onOpenChange={() => setCopied(false)}>
    <DialogTrigger render={<Button size="sm" variant="ghost" />}><Share2 data-icon="inline-start" />Share</DialogTrigger>
    <DialogPopup>
      <DialogHeader>
        <DialogTitle>Share</DialogTitle>
        <DialogDescription>Everyone in the workspace with Docs access can read this once it is published.</DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-lg border p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">{isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}</span>
          <span className="flex-1">
            <span className="block text-sm font-medium">Public link</span>
            <span className="block text-xs text-muted-foreground">{isPublic ? 'Anyone with the link can read it, no sign-in needed.' : 'Off. Only your workspace can read it.'}</span>
          </span>
          <Switch checked={isPublic} onCheckedChange={(checked) => onVisibility(checked ? 'public' : 'private')} />
        </label>
        {isPublic && (linkLive
          ? <div className="flex flex-wrap gap-2">
              <Button onClick={() => { void copy() }}>{copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}{copied ? 'Copied' : 'Copy link'}</Button>
              <Button variant="ghost" render={<a href={publicUrl ?? '#'} target="_blank" rel="noreferrer" />}><ExternalLink data-icon="inline-start" />Open page</Button>
            </div>
          : <p className="text-sm text-muted-foreground">{draft.status !== 'published' ? 'Publish the document to turn the link on.' : 'Saving…'}</p>)}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogPanel>
    </DialogPopup>
  </Dialog>
}
