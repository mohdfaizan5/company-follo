import { EmptyState } from '#/components/empty-state'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import { ChevronDown, ExternalLink, Network } from 'lucide-react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { personName } from '#/lib/people-client'
import type { Person } from '#/lib/people-client'
import '@xyflow/react/dist/style.css'

const NODE_WIDTH = 224
const NODE_HEIGHT = 82
const GAP_X = 32
const GAP_Y = 86

type PersonNodeData = { person: Person; reportCount: number; expanded: boolean; onToggle: (id: string) => void }
type TreeNode = Node<PersonNodeData, 'person'>

function PersonCard({ data }: NodeProps<TreeNode>) {
  const { person, reportCount, expanded, onToggle } = data
  const name = personName(person)
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <div className="w-56 rounded-xl border bg-card p-3 text-left shadow-sm">
    <Handle type="target" position={Position.Top} isConnectable={false} className="!pointer-events-none !h-0 !w-0 !border-0 !bg-transparent" />
    <div className="flex items-center gap-2.5"><Avatar className="size-9"><AvatarFallback>{initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground">{person.title}</p></div><Link to="/dashboard/people/$personId" params={{ personId: person.id }} onClick={(event) => event.stopPropagation()} aria-label={`Open ${name}'s profile`} className="nodrag grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><ExternalLink className="size-3.5" /></Link></div>
    {reportCount > 0 && <button type="button" className="nodrag mt-2 flex w-full items-center justify-between border-t pt-2 text-xs text-muted-foreground hover:text-foreground" onClick={(event) => { event.stopPropagation(); onToggle(person.employment_id) }} aria-expanded={expanded}><span>{reportCount} direct {reportCount === 1 ? 'report' : 'reports'}</span><ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>}
    <Handle type="source" position={Position.Bottom} isConnectable={false} className="!pointer-events-none !h-0 !w-0 !border-0 !bg-transparent" />
  </div>
}

const nodeTypes = { person: PersonCard }

function FlowTree({ people }: { people: Person[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const flow = useReactFlow()
  const children = useMemo(() => {
    const byManager = new Map<string, Person[]>()
    for (const person of people) {
      const key = person.manager_employment_id ?? ''
      byManager.set(key, [...(byManager.get(key) ?? []), person])
    }
    return byManager
  }, [people])
  const toggle = useCallback((employmentId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(employmentId)) next.delete(employmentId)
      else {
        const stack = [employmentId]
        while (stack.length) {
          const id = stack.pop()!
          next.add(id)
          for (const child of children.get(id) ?? []) stack.push(child.employment_id)
        }
      }
      return next
    })
  }, [children])

  const { nodes, edges } = useMemo(() => {
    const known = new Set(people.map((person) => person.employment_id))
    const roots = people.filter((person) => !person.manager_employment_id || !known.has(person.manager_employment_id))
    const visible: TreeNode[] = []
    const connections: Edge[] = []
    const visited = new Set<string>()
    function place(person: Person, left: number, depth: number): number {
      if (visited.has(person.employment_id)) return NODE_WIDTH + GAP_X
      visited.add(person.employment_id)
      const reports = expanded.has(person.employment_id) ? children.get(person.employment_id) ?? [] : []
      let width = NODE_WIDTH + GAP_X
      if (reports.length) {
        let childWidth = 0
        for (const report of reports) childWidth += measure(report, new Set(visited))
        width = Math.max(width, childWidth)
      }
      visible.push({ id: person.employment_id, type: 'person', position: { x: left + (width - NODE_WIDTH) / 2, y: depth * (NODE_HEIGHT + GAP_Y) }, data: { person, reportCount: (children.get(person.employment_id) ?? []).length, expanded: expanded.has(person.employment_id), onToggle: toggle }, draggable: false, connectable: false })
      let childLeft = left
      for (const report of reports) {
        const reportWidth = place(report, childLeft, depth + 1)
        connections.push({ id: `${person.employment_id}-${report.employment_id}`, source: person.employment_id, target: report.employment_id, type: 'smoothstep', style: { stroke: '#62666d', strokeWidth: 1.5 } })
        childLeft += reportWidth
      }
      return width
    }
    function measure(person: Person, seen: Set<string>): number {
      if (seen.has(person.employment_id)) return NODE_WIDTH + GAP_X
      seen.add(person.employment_id)
      const reports = expanded.has(person.employment_id) ? children.get(person.employment_id) ?? [] : []
      return Math.max(NODE_WIDTH + GAP_X, reports.reduce((sum, report) => sum + measure(report, new Set(seen)), 0))
    }
    let left = 0
    for (const root of roots) left += place(root, left, 0)
    return { nodes: visible, edges: connections }
  }, [people, children, expanded, toggle])

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void flow.fitView({ padding: 0.2, duration: 220 }) })
    return () => cancelAnimationFrame(frame)
  }, [nodes, flow])

  return <div className="h-[540px] overflow-hidden rounded-xl border bg-background">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onNodeClick={(_, node) => { if (node.data.reportCount > 0) toggle(node.id) }} fitView fitViewOptions={{ padding: 0.22 }} minZoom={0.35} maxZoom={1.25} proOptions={{ hideAttribution: true }} colorMode="dark" />
    <div className="sr-only">Select a reporting card to expand everyone below it. Use the profile icon to open a person.</div>
  </div>
}

export function ReportingTree({ people }: { people: Person[] }) {
  if (!people.length) return <EmptyState icon={Network} title="No reporting tree yet" description="Add your first person and the tree builds itself as you set who reports to whom." />
  return <div><div className="mb-3"><Badge variant="outline">{people.length} people</Badge></div><ReactFlowProvider><FlowTree people={people} /></ReactFlowProvider></div>
}
