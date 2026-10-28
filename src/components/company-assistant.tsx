import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useEveAgent } from 'eve/react'
import { Streamdown } from 'streamdown'
import type {
  ClientSessionState,
  EveMessage,
  EveToolPart,
  SessionStreamEvent,
} from 'eve/client'
import {
  ArrowUpIcon,
  CalendarDays,
  CheckIcon,
  CopyIcon,
  FileText,
  Landmark,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Bubble, BubbleContent } from '#/components/ui/bubble'
import { Card, CardContent } from '#/components/ui/card'
import type { ComposerValue } from '#/components/ui/composer'
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  getComposerText,
} from '#/components/ui/composer'
import { Message, MessageContent, MessageFooter } from '#/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '#/components/ui/message-scroller'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '#/components/ui/trace'

const storageKey = 'companyfollo:agent:conversation'

const examples = [
  {
    title: 'Find a person',
    description: 'Look up a teammate by name, role, or department.',
    prompt: 'Find the person who leads engineering.',
  },
  {
    title: 'Review the calendar',
    description: 'See upcoming leave, holidays, and pending requests.',
    prompt: 'What is coming up on the company calendar?',
  },
  {
    title: 'Get a company snapshot',
    description: 'See active people, pending leave, and payments this month.',
    prompt: 'Give me a company snapshot.',
  },
]

type SavedConversation = {
  events?: readonly SessionStreamEvent[]
  session?: ClientSessionState
}
type ChatMessage = EveMessage & { text: string }

function readConversation(): SavedConversation {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as SavedConversation) : {}
  } catch {
    return {}
  }
}

function messageText(parts: readonly { type: string; text?: string }[]) {
  return parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('')
}

/** Restores Eve's durable session only after hydration to avoid an SSR mismatch. */
export function CompanyAssistant() {
  const [saved, setSaved] = useState<SavedConversation>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSaved(readConversation())
    setReady(true)
  }, [])

  return (
    <AgentConversation
      key={saved.session?.sessionId ?? 'new'}
      initial={saved}
      prewarm={ready}
    />
  )
}

function AgentConversation({
  initial,
  prewarm,
}: {
  initial: SavedConversation
  prewarm: boolean
}) {
  const agent = useEveAgent({
    initialEvents: initial.events ?? [],
    initialSession: initial.session,
    prewarm,
    resume: initial.session !== undefined,
  })
  const [composerValue, setComposerValue] = useState<ComposerValue>([])
  const busy = agent.status === 'busy' || agent.status === 'resuming'
  const resuming = agent.status === 'resuming'
  const messages = agent.messages
    .map((message) => ({ ...message, text: messageText(message.parts) }))
    .filter(
      (message) =>
        message.text ||
        message.parts.some(
          (part) => part.type === 'tool' || part.type === 'reasoning',
        ),
    ) as ChatMessage[]

  useEffect(() => {
    if (typeof window === 'undefined' || !agent.session) return
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ events: agent.events, session: agent.session }),
    )
  }, [agent.events, agent.session])

  function send(text: string) {
    const prompt = text.trim()
    if (!prompt || resuming) return
    setComposerValue([])
    void agent.send(prompt, busy ? { turnPolicy: 'steer' } : undefined)
  }

  function newChat() {
    window.localStorage.removeItem(storageKey)
    setComposerValue([])
    agent.newSession()
  }

  const composer = (
    <AgentComposer
      value={composerValue}
      busy={busy}
      resuming={resuming}
      onChange={setComposerValue}
      onSubmit={(value) => send(getComposerText(value))}
    />
  )

  return (
    <div className="mx-auto flex h-[calc(100svh-5.5rem)] min-h-[30rem] w-full max-w-5xl flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="grid size-7 place-items-center rounded-md bg-primary/12 p-1.5">
            <img src="/logo.svg" alt="" className="size-full" />
          </span>
          CompanyFollo Agent
        </div>
        <Button size="sm" variant="ghost" onClick={newChat}>
          <RotateCcw data-icon="inline-start" />
          New chat
        </Button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        {messages.length === 0 ? (
          <Welcome composer={composer} onPrompt={send} disabled={resuming} />
        ) : (
          <>
            <Conversation
              messages={messages}
              busy={busy}
              error={agent.error?.message}
              onRespond={(interactionId, optionId) =>
                void agent.respond([{ interactionId, optionId }])
              }
            />
            <footer className="shrink-0 border-t bg-background/92 py-3 backdrop-blur-sm">
              {composer}
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

function AgentComposer({
  value,
  busy,
  resuming,
  onChange,
  onSubmit,
}: {
  value: ComposerValue
  busy: boolean
  resuming: boolean
  onChange: (next: ComposerValue) => void
  onSubmit: (next: ComposerValue) => void
}) {
  return (
    <Composer
      value={value}
      onValueChange={onChange}
      onSubmit={onSubmit}
      disabled={resuming}
      className="mx-auto min-h-28 w-full max-w-3xl rounded-xl bg-card shadow-[0_1px_2px_rgb(0_0_0_/_0.08)]"
    >
      <ComposerInput
        aria-label="Message the CompanyFollo Agent"
        placeholder={
          busy
            ? 'Add a follow-up while Agent works…'
            : 'Ask Agent about your company…'
        }
        className="min-h-16 px-3 pt-3 text-base"
      />
      <ComposerActions>
        <ComposerActionGroup>
          <span className="inline-flex min-h-8 items-center gap-1.5 px-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            Company data · actions need approval
          </span>
        </ComposerActionGroup>
        <ComposerActionGroup align="end">
          <ComposerSubmit
            render={
              <Button size="icon-sm" aria-label="Send message">
                <ArrowUpIcon aria-hidden="true" />
              </Button>
            }
          />
        </ComposerActionGroup>
      </ComposerActions>
    </Composer>
  )
}

function Welcome({
  composer,
  onPrompt,
  disabled,
}: {
  composer: ReactNode
  onPrompt: (prompt: string) => void
  disabled: boolean
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center pb-10">
      {composer}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {examples.map((example) => (
          <button
            key={example.title}
            type="button"
            disabled={disabled}
            onClick={() => onPrompt(example.prompt)}
            className="group flex min-h-36 flex-col rounded-xl border bg-card p-4 text-left shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] transition-[background-color,transform] hover:bg-accent/50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-64"
          >
            <Sparkles
              className="size-4 text-primary opacity-80"
              aria-hidden="true"
            />
            <span className="mt-auto font-medium tracking-[-0.015em]">
              {example.title}
            </span>
            <span className="mt-1 text-sm leading-5 text-muted-foreground">
              {example.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Conversation({
  messages,
  busy,
  error,
  onRespond,
}: {
  messages: ChatMessage[]
  busy: boolean
  error?: string
  onRespond: (interactionId: string, optionId?: string) => void
}) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="mx-auto h-full w-full max-w-3xl flex-1 py-5">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-6 pb-5">
            {messages.map((message, index) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.role === 'user'}
              >
                <ChatTurn
                  message={message}
                  isStreaming={
                    message.metadata?.status === 'streaming' ||
                    (busy &&
                      index === messages.length - 1 &&
                      message.role === 'assistant')
                  }
                  onRespond={onRespond}
                />
              </MessageScrollerItem>
            ))}
            {busy ? (
              <MessageScrollerItem scrollAnchor>
                <Trace>
                  <TraceLine status="running">
                    <TraceIcon>
                      <Sparkles />
                    </TraceIcon>
                    <TraceTitle>Agent is working…</TraceTitle>
                  </TraceLine>
                </Trace>
              </MessageScrollerItem>
            ) : null}
            {error ? (
              <MessageScrollerItem>
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function ChatTurn({
  message,
  isStreaming,
  onRespond,
}: {
  message: ChatMessage
  isStreaming: boolean
  onRespond: (interactionId: string, optionId?: string) => void
}) {
  if (message.role === 'user')
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>{message.text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  return (
    <AssistantMessage
      text={message.text}
      parts={message.parts}
      isStreaming={isStreaming}
      onRespond={onRespond}
    />
  )
}

function AssistantMessage({
  text,
  parts,
  isStreaming,
  onRespond,
}: {
  text: string
  parts: EveMessage['parts']
  isStreaming: boolean
  onRespond: (interactionId: string, optionId?: string) => void
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Message>
      <MessageContent className="max-w-2xl gap-2 text-sm leading-7 text-foreground">
        <ReasoningTrace parts={parts} isStreaming={isStreaming} />
        <ToolResults parts={parts} onRespond={onRespond} />
        {text ? (
          <Streamdown
            mode="streaming"
            animated={{ animation: 'fadeIn', duration: 120, stagger: 8 }}
            isAnimating={isStreaming}
            caret={isStreaming ? 'block' : undefined}
            className="agent-markdown max-w-none text-[15px] leading-7 text-pretty"
            components={{
              a: ({ children, href, node: _node, ...props }) => (
                <a
                  {...props}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  {children}
                </a>
              ),
            }}
          >
            {text}
          </Streamdown>
        ) : null}
        {text ? (
          <MessageFooter>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copied ? 'Copied response' : 'Copy response'}
              onClick={() => void copy()}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  )
}

function ReasoningTrace({
  parts,
  isStreaming,
}: {
  parts: EveMessage['parts']
  isStreaming: boolean
}) {
  const reasoning = parts
    .filter(
      (
        part,
      ): part is Extract<EveMessage['parts'][number], { type: 'reasoning' }> =>
        part.type === 'reasoning' && Boolean(part.text),
    )
    .map((part) => part.text)
    .join('\n')
  if (!reasoning) return null

  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={isStreaming ? 'running' : undefined}>
            <TraceIcon>
              <Sparkles />
            </TraceIcon>
            <TraceTitle>{isStreaming ? 'Thinking…' : 'Reasoning'}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Streamdown
            mode="streaming"
            isAnimating={isStreaming}
            className="agent-reasoning text-sm leading-6"
          >
            {reasoning}
          </Streamdown>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

function ToolResults({
  parts,
  onRespond,
}: {
  parts: EveMessage['parts']
  onRespond: (interactionId: string, optionId?: string) => void
}) {
  const tools = parts.filter(
    (part): part is EveToolPart => part.type === 'tool',
  )
  if (!tools.length) return null

  return (
    <div className="flex flex-col gap-3">
      {tools.map((tool) => (
        <ToolResult key={tool.callId} tool={tool} onRespond={onRespond} />
      ))}
    </div>
  )
}

function ToolResult({
  tool,
  onRespond,
}: {
  tool: EveToolPart
  onRespond: (interactionId: string, optionId?: string) => void
}) {
  if (tool.interaction?.status === 'open') {
    return (
      <ApprovalCard
        title={tool.interaction.request.title ?? 'Approve this change?'}
        prompt={tool.interaction.request.prompt}
        interactionId={tool.interaction.interactionId}
        options={tool.interaction.request.options ?? []}
        onRespond={onRespond}
      />
    )
  }

  const output = asRecord(tool.output)
  if (output) return <StructuredResult output={output} />

  if (tool.state === 'streaming') {
    return (
      <Trace>
        <TraceLine status="running">
          <TraceIcon>
            <Sparkles />
          </TraceIcon>
          <TraceTitle>{tool.label}</TraceTitle>
        </TraceLine>
      </Trace>
    )
  }

  if (tool.error) {
    return <p className="text-sm text-destructive">{tool.error.message}</p>
  }

  return null
}

function ApprovalCard({
  title,
  prompt,
  interactionId,
  options,
  onRespond,
}: {
  title: string
  prompt: string
  interactionId: string
  options: readonly { id: string; label: string; style?: string }[]
  onRespond: (interactionId: string, optionId?: string) => void
}) {
  return (
    <Card className="max-w-xl border-primary/30 bg-primary/4 shadow-none">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <p className="font-medium leading-5">{title}</p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{prompt}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={
                option.style === 'danger'
                  ? 'destructive'
                  : option.id === 'deny'
                    ? 'outline'
                    : 'default'
              }
              onClick={() => onRespond(interactionId, option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StructuredResult({ output }: { output: Record<string, unknown> }) {
  const view = stringValue(output.view)
  if (view === 'company_snapshot') return <SnapshotResult output={output} />
  if (view === 'people_list') return <PeopleResult output={output} />
  if (view === 'calendar_overview') return <CalendarResult output={output} />
  if (view === 'documents_list') return <DocumentsResult output={output} />
  if (view === 'person_profile') return <PersonProfileResult output={output} />
  if (view === 'action_result') return <ActionResult output={output} />
  return null
}

function SnapshotResult({ output }: { output: Record<string, unknown> }) {
  const stats = [
    ['People', output.activePeople, Users],
    ['Pending leave', output.pendingLeaveRequests, CalendarDays],
    ['Payments this month', output.paymentsRecordedThisMonth, Landmark],
  ] as const
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {stats.map(([label, value, Icon]) => (
        <Card key={label} className="shadow-none">
          <CardContent className="flex items-center gap-3 p-3">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{String(value ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PeopleResult({ output }: { output: Record<string, unknown> }) {
  const people = recordList(output.people)
  if (!people.length) return null
  return (
    <Card className="max-w-xl shadow-none">
      <CardContent className="p-2">
        {people.slice(0, 6).map((person, index) => (
          <ResultLink
            key={`${stringValue(person.id) ?? index}`}
            href={stringValue(person.profileUrl)}
            title={stringValue(person.name) ?? 'Person'}
            detail={[stringValue(person.title), stringValue(person.department)]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function CalendarResult({ output }: { output: Record<string, unknown> }) {
  const holidays = recordList(output.holidays)
  const leave = recordList(output.leave)
  return (
    <Card className="max-w-xl shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <CalendarDays className="size-4 text-muted-foreground" />
            Calendar overview
          </div>
          <a
            href="/dashboard/time-off"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline underline-offset-4"
          >
            Open calendar
          </a>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {String(output.pendingRequestCount ?? 0)} pending request
          {Number(output.pendingRequestCount ?? 0) === 1 ? '' : 's'}.
        </p>
        {holidays.slice(0, 2).map((holiday, index) => (
          <p
            key={`${stringValue(holiday.date) ?? index}`}
            className="mt-2 text-sm"
          >
            {stringValue(holiday.date)} · {stringValue(holiday.name)}
          </p>
        ))}
        {leave.slice(0, 2).map((item, index) => (
          <p
            key={`${stringValue(item.person) ?? index}`}
            className="mt-2 text-sm"
          >
            {stringValue(item.person)} · {stringValue(item.startDate)} to{' '}
            {stringValue(item.endDate)}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

function DocumentsResult({ output }: { output: Record<string, unknown> }) {
  const documents = recordList(output.documents)
  if (!documents.length) return null
  return (
    <Card className="max-w-xl shadow-none">
      <CardContent className="p-2">
        {documents.slice(0, 5).map((document, index) => (
          <ResultLink
            key={`${stringValue(document.id) ?? index}`}
            href={stringValue(document.documentUrl)}
            title={stringValue(document.title) ?? 'Document'}
            detail={[stringValue(document.kind), stringValue(document.status)]
              .filter(Boolean)
              .join(' · ')}
            icon={<FileText className="size-4 text-muted-foreground" />}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function PersonProfileResult({ output }: { output: Record<string, unknown> }) {
  if (output.found === false) {
    return (
      <Card className="max-w-xl shadow-none">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {stringValue(output.message) ?? 'Person not found.'}
        </CardContent>
      </Card>
    )
  }
  const detail = [
    stringValue(output.title),
    stringValue(output.department),
    stringValue(output.level),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Card className="max-w-xl shadow-none">
      <CardContent className="p-2">
        <ResultLink
          href={stringValue(output.profileUrl)}
          title={stringValue(output.name) ?? 'Person'}
          detail={detail}
        />
      </CardContent>
    </Card>
  )
}

function ActionResult({ output }: { output: Record<string, unknown> }) {
  const entity =
    asRecord(output.person) ??
    asRecord(output.document) ??
    asRecord(output.payment) ??
    asRecord(output.holiday)
  const href =
    stringValue(entity?.profileUrl) ??
    stringValue(entity?.documentUrl) ??
    stringValue(output.calendarUrl) ??
    stringValue(output.payrollUrl)
  return (
    <Card className="max-w-xl border-success/25 bg-success/4 shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <CheckIcon className="mt-0.5 size-4 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-5">
            {stringValue(output.message) ?? 'Change completed.'}
          </p>
          {entity ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {stringValue(entity.name) ??
                stringValue(entity.title) ??
                stringValue(entity.type) ??
                ''}
            </p>
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm text-primary underline underline-offset-4"
            >
              Open in CompanyFollo
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function ResultLink({
  href,
  title,
  detail,
  icon = <Users className="size-4 text-muted-foreground" />,
}: {
  href?: string
  title: string
  detail?: string
  icon?: ReactNode
}) {
  const content = (
    <>
      <span className="grid size-7 place-items-center rounded-md bg-muted">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        {detail ? (
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
    </>
  )
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md px-2 py-2 no-underline hover:bg-muted"
    >
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-2 rounded-md px-2 py-2">
      {content}
    </div>
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function recordList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
    : []
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null
}
