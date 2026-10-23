import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronRight, FileText, ListFilter, Plus, Receipt, Settings2, Shield, UserPlus } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { EmptyState } from '#/components/empty-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import { Menu, MenuCheckboxItem, MenuGroup, MenuGroupLabel, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '#/components/ui/menu'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsList, TabsTab } from '#/components/ui/tabs'
import { docTemplates } from '#/lib/doc-templates'
import { useWorkspace } from '#/lib/workspace-client'
import type { DocTemplate } from '#/lib/doc-templates'

type Doc = { id: string; title: string; kind: string; visibility: string; status: string; updated_at: string }
type NewDoc = { title: string; kind?: string; content?: DocTemplate['content'] }

async function getDocs() {
  const response = await fetch('/api/docs')
  const payload = await response.json() as { documents?: Doc[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load documents.')
  return payload.documents ?? []
}

export const Route = createFileRoute('/dashboard/docs/')({ component: DocsPage })

const kinds = [
  { value: 'general', label: 'Document' },
  { value: 'policy', label: 'Policy' },
  { value: 'sop', label: 'SOP' },
  { value: 'guide', label: 'Guide' },
]
const templateIcons = { calendar: Calendar, 'user-plus': UserPlus, receipt: Receipt, shield: Shield }

function DocsPage() {
  const docs = useQuery({ queryKey: ['handbook-docs'], queryFn: getDocs, staleTime: 30_000 })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const workspace = useWorkspace(true)
  const canWrite = Boolean(workspace.data?.permissions.docs.write)
  // View state: tab, kind filter and display options
  const [tab, setTab] = useState<'all' | 'published' | 'drafts'>('all')
  const [activeKinds, setActiveKinds] = useState<string[]>([])
  const [sort, setSort] = useState<'updated' | 'title'>('updated')
  const [showDetails, setShowDetails] = useState(true)

  const create = useMutation({
    mutationFn: async (input: NewDoc) => {
      const response = await fetch('/api/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      const payload = await response.json() as { document?: { id: string }; error?: string }
      if (!response.ok || !payload.document) throw new Error(payload.error ?? 'Could not create document.')
      return payload.document
    },
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: ['handbook-docs'] })
      await navigate({ to: '/dashboard/docs/$documentId', params: { documentId: document.id } })
    },
  })

  // Press C anywhere on the page (outside a field) to start a new document
  const startBlank = () => { if (canWrite && !create.isPending) create.mutate({ title: 'Untitled' }) }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'c' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      event.preventDefault()
      startBlank()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const visible = useMemo(() => {
    const list = (docs.data ?? []).filter((doc) => (tab === 'all' || (tab === 'published' ? doc.status === 'published' : doc.status !== 'published')) && (!activeKinds.length || activeKinds.includes(doc.kind)))
    return sort === 'title' ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : list
  }, [docs.data, tab, activeKinds, sort])
  const hasDocs = Boolean(docs.data?.length)

  return <DashboardPage title="Docs" showHeading={false}>
    <div className="flex flex-col gap-6">
      {/* Toolbar: title, All / Published / Drafts tabs, then Filter, Display and New document */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="flex items-center gap-2 font-heading text-base font-semibold"><FileText className="size-4 text-muted-foreground" aria-hidden="true" />Docs</h1>
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <TabsList>
              <TabsTab value="all">All</TabsTab>
              <TabsTab value="published">Published</TabsTab>
              <TabsTab value="drafts">Drafts</TabsTab>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter by kind */}
          <Menu>
            <MenuTrigger render={<Button variant="ghost" className="text-muted-foreground" />}>
              <ListFilter data-icon="inline-start" />Filter{activeKinds.length ? <Badge variant="secondary" size="sm">{activeKinds.length}</Badge> : null}
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Type</MenuGroupLabel>
                {kinds.map((kind) => <MenuCheckboxItem key={kind.value} checked={activeKinds.includes(kind.value)} onCheckedChange={(checked) => setActiveKinds((current) => checked ? [...current, kind.value] : current.filter((value) => value !== kind.value))}>{kind.label}</MenuCheckboxItem>)}
              </MenuGroup>
              {activeKinds.length > 0 && <><MenuSeparator /><MenuCheckboxItem checked={false} onCheckedChange={() => setActiveKinds([])}>Clear filters</MenuCheckboxItem></>}
            </MenuPopup>
          </Menu>
          {/* Display options: sort order and row details */}
          <Menu>
            <MenuTrigger render={<Button variant="outline" />}><Settings2 data-icon="inline-start" />Display</MenuTrigger>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Order by</MenuGroupLabel>
                <MenuRadioGroup value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
                  <MenuRadioItem value="updated">Last updated</MenuRadioItem>
                  <MenuRadioItem value="title">Title (A–Z)</MenuRadioItem>
                </MenuRadioGroup>
              </MenuGroup>
              <MenuSeparator />
              <MenuCheckboxItem checked={showDetails} onCheckedChange={setShowDetails}>Show details</MenuCheckboxItem>
            </MenuPopup>
          </Menu>
          {canWrite && <Button onClick={startBlank} loading={create.isPending}><Plus data-icon="inline-start" /><span className="sm:hidden">New</span><span className="max-sm:hidden">New document</span></Button>}
        </div>
      </div>

      {create.isError && <p role="alert" className="text-sm text-destructive">{create.error.message}</p>}
      {docs.isPending && <p className="text-sm text-muted-foreground">Loading documents…</p>}
      {docs.isError && <p role="alert" className="text-sm text-destructive">{docs.error.message}</p>}

      {/* Empty state: illustration, intro, primary action with the C shortcut, then starter templates */}
      {docs.data && !hasDocs && <div className="mx-auto flex w-full max-w-xl flex-col gap-8 py-8 sm:py-16">
        <div className="relative h-24 w-28" aria-hidden="true">
          <div className="absolute inset-y-1 right-0 w-20 rotate-6 rounded-lg border bg-card/60" />
          <div className="absolute bottom-0 left-2 flex h-22 w-18 flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-sm/5">
            <span className="h-0.5 w-8 rounded-full bg-muted-foreground/50" /><span className="h-0.5 w-10 rounded-full bg-muted-foreground/30" /><span className="h-0.5 w-8 rounded-full bg-muted-foreground/30" /><span className="h-0.5 w-6 rounded-full bg-muted-foreground/30" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Docs</h2>
          <p className="text-muted-foreground text-pretty">Write your company&apos;s policies, SOPs and guides in one place. Drafts stay private until you publish them, then everyone can read them.</p>
        </div>
        {canWrite ? <div className="flex flex-wrap items-center gap-3">
          <Button onClick={startBlank} loading={create.isPending}>Create new document<Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">C</Kbd></Button>
        </div> : <p className="text-sm text-muted-foreground">Ask the owner or HR to add the first document.</p>}
        {canWrite && <>
          <Separator />
          <div className="flex flex-col gap-1">
            <h3 className="mb-2 text-sm text-muted-foreground">Or start from a template</h3>
            {docTemplates.map((template) => {
              const Icon = templateIcons[template.icon]
              return <button
                key={template.id}
                type="button"
                disabled={create.isPending}
                onClick={() => create.mutate({ title: template.title, kind: template.kind, content: template.content })}
                className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-64"
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 font-medium">{template.title}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            })}
          </div>
        </>}
      </div>}

      {/* Nothing matches the current tab or filters */}
      {hasDocs && visible.length === 0 && <EmptyState icon={FileText} title="No documents here" description="Nothing matches this tab and filter. Try another tab or clear the filters." />}

      {/* Document list */}
      {visible.length > 0 && <div className="divide-y rounded-xl border bg-card">
        {visible.map((doc) => <Link key={doc.id} to="/dashboard/docs/$documentId" params={{ documentId: doc.id }} className="flex items-center gap-3 px-4 py-3.5 no-underline transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/50">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{doc.title}</span>
            {showDetails && <span className="text-xs text-muted-foreground">{kinds.find((kind) => kind.value === doc.kind)?.label ?? doc.kind} · {doc.status !== 'published' ? 'Draft' : doc.visibility === 'public' ? 'Public link' : 'Workspace only'}</span>}
          </span>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{new Date(doc.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </Link>)}
      </div>}
    </div>
  </DashboardPage>
}
