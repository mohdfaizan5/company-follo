import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Calendar, ChevronDown, ChevronRight, FileText, ListChecks, ListFilter, Plus, Receipt, ScrollText, Search, Shield, SlidersHorizontal, UserPlus } from 'lucide-react'
import { DashboardPage } from '#/components/dashboard-page'
import { EmptyState } from '#/components/empty-state'
import { TableSkeleton } from '#/components/page-skeletons'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Kbd } from '#/components/ui/kbd'
import { Menu, MenuCheckboxItem, MenuGroup, MenuGroupLabel, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '#/components/ui/menu'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsList, TabsTab } from '#/components/ui/tabs'
import { Tooltip, TooltipPopup, TooltipTrigger } from '#/components/ui/tooltip'
import { docTemplates } from '#/lib/doc-templates'
import { cn } from '#/lib/utils'
import { useWorkspace } from '#/lib/workspace-client'
import type { DocTemplate } from '#/lib/doc-templates'

type Doc = { id: string; title: string; kind: string; visibility: string; status: string; created_at: string; updated_at: string; owner_name: string | null; owner_image: string | null }
type NewDoc = { title: string; kind?: string; content?: DocTemplate['content'] }

async function getDocs() {
  const response = await fetch('/api/docs')
  const payload = await response.json() as { documents?: Doc[]; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load documents.')
  return payload.documents ?? []
}

export const docsQueryOptions = { queryKey: ['handbook-docs'] as const, queryFn: getDocs, staleTime: 30_000 }

export const Route = createFileRoute('/dashboard/docs/')({
  loader: async ({ context }) => {
    if (typeof window === 'undefined') return
    void context.queryClient.prefetchQuery(docsQueryOptions)
  },
  component: DocsPage,
})

// Sections in the order they appear on the page.
const kinds = [
  { value: 'policy', label: 'Policies', single: 'Policy', icon: Shield, tint: 'text-emerald-500' },
  { value: 'sop', label: 'SOPs', single: 'SOP', icon: ListChecks, tint: 'text-amber-500' },
  { value: 'guide', label: 'Guides', single: 'Guide', icon: BookOpen, tint: 'text-sky-500' },
  { value: 'general', label: 'Team documents', single: 'Document', icon: ScrollText, tint: 'text-violet-500' },
]
const templateIcons = { calendar: Calendar, 'user-plus': UserPlus, receipt: Receipt, shield: Shield }

export function timeAgo(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const steps: [number, string][] = [[60, 'm'], [24, 'h'], [7, 'd'], [4.35, 'w'], [12, 'mo']]
  let amount = seconds / 60
  for (const [size, unit] of steps) {
    if (amount < size) return `${Math.floor(amount)}${unit} ago`
    amount /= size
  }
  return `${Math.floor(amount)}y ago`
}

function DocsPage() {
  const docs = useQuery(docsQueryOptions)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const workspace = useWorkspace(true)
  const canWrite = Boolean(workspace.data?.permissions.docs.write)
  const [tab, setTab] = useState<'all' | 'published' | 'drafts'>('all')
  const [activeKinds, setActiveKinds] = useState<string[]>([])
  const [sort, setSort] = useState<{ key: 'title' | 'created_at' | 'updated_at'; desc: boolean }>({ key: 'updated_at', desc: true })
  const [grouped, setGrouped] = useState(true)
  const [search, setSearch] = useState('')
  const [closed, setClosed] = useState<Set<string>>(() => new Set())

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
  const startBlank = (kind = 'general') => { if (canWrite && !create.isPending) create.mutate({ title: 'Untitled', kind }) }
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
    const term = search.trim().toLowerCase()
    const list = (docs.data ?? []).filter((doc) =>
      (tab === 'all' || (tab === 'published' ? doc.status === 'published' : doc.status !== 'published'))
      && (!activeKinds.length || activeKinds.includes(doc.kind))
      && (!term || doc.title.toLowerCase().includes(term)))
    return [...list].sort((a, b) => a[sort.key].localeCompare(b[sort.key]) * (sort.desc ? -1 : 1))
  }, [docs.data, tab, activeKinds, sort, search])
  const sections = grouped
    ? kinds.map((kind) => ({ ...kind, docs: visible.filter((doc) => doc.kind === kind.value) })).filter((section) => section.docs.length)
    : [{ ...kinds[3], label: 'All documents', docs: visible }]
  const hasDocs = Boolean(docs.data?.length)

  function sortHeader(key: typeof sort.key, label: string, className?: string) {
    const active = sort.key === key
    return (
      <button type="button" className={cn('flex items-center gap-1 text-left hover:text-foreground', active && 'text-foreground', className)} onClick={() => setSort({ key, desc: active ? !sort.desc : key !== 'title' })}>
        {label}{active && (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
      </button>
    )
  }

  return <DashboardPage title="Docs" showHeading={false} skeleton="table" wide>
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.04em]">Docs</h1>
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <TabsList>
              <TabsTab value="all">All</TabsTab>
              <TabsTab value="published">Published</TabsTab>
              <TabsTab value="drafts">Drafts</TabsTab>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative max-sm:hidden">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input size="sm" className="w-48 ps-8" placeholder="Search docs" aria-label="Search docs" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {canWrite && <Button variant="outline" size="sm" onClick={() => startBlank()} loading={create.isPending}><Plus data-icon="inline-start" />New document</Button>}
          <Menu>
            <Tooltip>
              <TooltipTrigger render={<MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Filter" className="relative" />} />}>
                <ListFilter />
                {activeKinds.length > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
              </TooltipTrigger>
              <TooltipPopup>Filter</TooltipPopup>
            </Tooltip>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Type</MenuGroupLabel>
                {kinds.map((kind) => <MenuCheckboxItem key={kind.value} checked={activeKinds.includes(kind.value)} onCheckedChange={(checked) => setActiveKinds((current) => checked ? [...current, kind.value] : current.filter((value) => value !== kind.value))}>{kind.single}</MenuCheckboxItem>)}
              </MenuGroup>
              {activeKinds.length > 0 && <><MenuSeparator /><MenuCheckboxItem checked={false} onCheckedChange={() => setActiveKinds([])}>Clear filters</MenuCheckboxItem></>}
            </MenuPopup>
          </Menu>
          <Menu>
            <Tooltip>
              <TooltipTrigger render={<MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Display options" />} />}><SlidersHorizontal /></TooltipTrigger>
              <TooltipPopup>Display</TooltipPopup>
            </Tooltip>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Order by</MenuGroupLabel>
                <MenuRadioGroup value={sort.key} onValueChange={(value) => setSort({ key: value as typeof sort.key, desc: value !== 'title' })}>
                  <MenuRadioItem value="updated_at">Last edited</MenuRadioItem>
                  <MenuRadioItem value="created_at">Created</MenuRadioItem>
                  <MenuRadioItem value="title">Name</MenuRadioItem>
                </MenuRadioGroup>
              </MenuGroup>
              <MenuSeparator />
              <MenuCheckboxItem checked={grouped} onCheckedChange={setGrouped}>Group by type</MenuCheckboxItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>

      {create.isError && <p role="alert" className="text-sm text-destructive">{create.error.message}</p>}
      {docs.isPending && <TableSkeleton />}
      {docs.isError && <p role="alert" className="text-sm text-destructive">{docs.error.message}</p>}

      {docs.data && !hasDocs && <div className="mx-auto flex w-full max-w-xl flex-col gap-8 py-8 sm:py-16">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Docs</h2>
          <p className="text-muted-foreground text-pretty">Write your company&apos;s policies, SOPs and guides in one place. Drafts stay private until you publish them, then everyone can read them.</p>
        </div>
        {canWrite ? <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => startBlank()} loading={create.isPending}>Create new document<Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">C</Kbd></Button>
        </div> : <p className="text-sm text-muted-foreground">Ask the owner or HR to add the first document.</p>}
        {canWrite && <>
          <Separator />
          <div className="flex flex-col gap-1">
            <h3 className="mb-2 text-sm text-muted-foreground">Or start from a template</h3>
            {docTemplates.map((template) => {
              const Icon = templateIcons[template.icon]
              return <button key={template.id} type="button" disabled={create.isPending} onClick={() => create.mutate({ title: template.title, kind: template.kind, content: template.content })} className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-64">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 font-medium">{template.title}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            })}
          </div>
        </>}
      </div>}

      {hasDocs && visible.length === 0 && <EmptyState icon={FileText} title="No documents here" description="Nothing matches this tab, search or filter." />}

      {visible.length > 0 && <div role="table" aria-label="Documents" className="text-sm">
        <div role="row" className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4 px-3 pb-2 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_7rem_7rem_11rem]">
          <span role="columnheader">{sortHeader('title', 'Name', 'pl-7')}</span>
          <span role="columnheader" className="max-sm:hidden">{sortHeader('created_at', 'Created')}</span>
          <span role="columnheader">{sortHeader('updated_at', 'Last edited')}</span>
          <span role="columnheader" className="max-sm:hidden">Owner</span>
        </div>
        {sections.map((section) => {
          const open = !closed.has(section.value)
          const Icon = section.icon
          return <div key={section.value} role="rowgroup" className="mb-1">
            {grouped && <div className="group flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-2">
              <button type="button" aria-expanded={open} onClick={() => setClosed((current) => { const next = new Set(current); if (next.has(section.value)) next.delete(section.value); else next.add(section.value); return next })} className="flex flex-1 items-center gap-2 text-left">
                <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', !open && '-rotate-90')} />
                <Icon className={cn('size-4', section.tint)} />
                <span className="font-medium">{section.label}</span>
                <span className="text-muted-foreground tabular-nums">{section.docs.length}</span>
              </button>
              {canWrite && <Button size="icon-xs" variant="ghost" aria-label={`New ${section.single.toLowerCase()}`} className="opacity-60 group-hover:opacity-100" onClick={() => startBlank(section.value)}><Plus /></Button>}
            </div>}
            {open && section.docs.map((doc) => <Link key={doc.id} role="row" to="/dashboard/docs/$documentId" params={{ documentId: doc.id }} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-4 rounded-lg px-3 py-3 no-underline transition-colors hover:bg-accent/50 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_11rem]">
              <span role="cell" className="flex min-w-0 items-center gap-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium">{doc.title || 'Untitled'}</span>
                {doc.status !== 'published' && <Badge variant="outline" size="sm" className="shrink-0">Draft</Badge>}
                {doc.status === 'published' && doc.visibility === 'public' && <Badge variant="info" size="sm" className="shrink-0">Public</Badge>}
              </span>
              <span role="cell" className="text-muted-foreground tabular-nums max-sm:hidden" title={new Date(doc.created_at).toLocaleString()}>{timeAgo(doc.created_at)}</span>
              <span role="cell" className="text-muted-foreground tabular-nums" title={new Date(doc.updated_at).toLocaleString()}>{timeAgo(doc.updated_at)}</span>
              <span role="cell" className="flex min-w-0 items-center gap-2 max-sm:hidden">
                <Avatar className="size-5">
                  {doc.owner_image && <AvatarImage src={doc.owner_image} alt="" />}
                  <AvatarFallback className="text-[9px]">{(doc.owner_name ?? '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate">{doc.owner_name ?? 'Unknown'}</span>
              </span>
            </Link>)}
          </div>
        })}
      </div>}
    </div>
  </DashboardPage>
}
