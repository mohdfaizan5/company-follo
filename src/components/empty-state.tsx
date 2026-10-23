import type { LucideIcon } from 'lucide-react'
import { Card, CardFrame, CardFrameAction, CardFrameDescription, CardFrameHeader, CardFrameTitle, CardPanel } from '#/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { cn } from '#/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  /** Buttons or links shown under the description. */
  children?: React.ReactNode
  /** Set to render the full framed card with a header, like a standalone section. Omit to sit inside an existing card. */
  frame?: { title: string; description?: string; action?: React.ReactNode }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, children, frame, className }: EmptyStateProps) {
  const empty = (
    <Empty className={cn(!frame && 'py-8 md:py-10', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
  if (!frame) return empty
  return (
    <CardFrame className="w-full">
      <CardFrameHeader>
        <CardFrameTitle>{frame.title}</CardFrameTitle>
        {frame.description ? <CardFrameDescription>{frame.description}</CardFrameDescription> : null}
        {frame.action ? <CardFrameAction>{frame.action}</CardFrameAction> : null}
      </CardFrameHeader>
      <Card><CardPanel>{empty}</CardPanel></Card>
    </CardFrame>
  )
}
