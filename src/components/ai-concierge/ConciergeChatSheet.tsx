import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaperPlaneTilt, Sparkle, Wrench } from '@phosphor-icons/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  streamConciergeChat,
  type ConciergeFinalPayload,
} from '@/lib/concierge-client'
import { PlanPreviewCard, type ProposedPlan } from './PlanPreviewCard'

interface ConciergeChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  authToken?: string
  userLocation?: { lat: number; lng: number }
  onSavePlan?: (plan: ProposedPlan) => Promise<void>
  onShareWithCrew?: (plan: ProposedPlan) => void
}

type UiMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; toolCalls: Array<{ name: string; input: unknown }> }
  | { id: string; role: 'system'; text: string }

/**
 * Extract a plan object from the Anthropic message transcript, if one is
 * present. We look for a `build_plan` tool call and pair it with its
 * subsequent `tool_result`. Resilient to the v1 stub shape (`plan: null`).
 */
function extractProposedPlan(messages: ConciergeFinalPayload['messages']): ProposedPlan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!Array.isArray(m.content)) continue
    for (const block of m.content as Array<Record<string, unknown>>) {
      if (block?.type === 'tool_result' && typeof block.content === 'string') {
        try {
          const parsed = JSON.parse(block.content) as { plan?: ProposedPlan | null }
          if (parsed?.plan && Array.isArray(parsed.plan.stops)) return parsed.plan
        } catch {
          /* skip */
        }
      }
    }
  }
  return null
}

export function ConciergeChatSheet({
  open,
  onOpenChange,
  sessionId,
  authToken,
  userLocation,
  onSavePlan,
  onShareWithCrew,
}: ConciergeChatSheetProps) {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [plan, setPlan] = useState<ProposedPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const samplePrompts = useMemo(
    () => [
      'Plan 4 of us, $80pp, Williamsburg, end by 2am, one veg',
      'Quiet date night, under $150 total, wine-forward',
      'Low-key birthday for 6 — no club, ends by midnight',
    ],
    [],
  )

  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, plan])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setSending(true)
      setError(null)
      const userMsg: UiMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed }
      setMessages((prev) => [...prev, userMsg])
      setInput('')

      const apiMessages = [
        ...messages
          .filter((m): m is Extract<UiMessage, { role: 'user' | 'assistant' }> =>
            m.role === 'user' || m.role === 'assistant',
          )
          .map((m) => ({ role: m.role, content: m.text })),
        { role: 'user' as const, content: trimmed },
      ]

      const assistantMsg: UiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        toolCalls: [],
      }
      setMessages((prev) => [...prev, assistantMsg])

      try {
        for await (const delta of streamConciergeChat({
          sessionId,
          messages: apiMessages,
          userContext: userLocation ? { location: userLocation } : undefined,
          authToken,
        })) {
          if (delta.kind === 'error') {
            setError(delta.message)
            break
          }
          if (delta.kind === 'text') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id && m.role === 'assistant'
                  ? { ...m, text: m.text + delta.text }
                  : m,
              ),
            )
          }
          if (delta.kind === 'tool_call') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id && m.role === 'assistant'
                  ? { ...m, toolCalls: [...m.toolCalls, { name: delta.name, input: delta.input }] }
                  : m,
              ),
            )
          }
          if (delta.kind === 'message') {
            const proposed = extractProposedPlan(delta.payload.messages)
            if (proposed) setPlan(proposed)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id && m.role === 'assistant'
                  ? { ...m, text: delta.payload.text }
                  : m,
              ),
            )
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSending(false)
      }
    },
    [messages, sending, sessionId, userLocation, authToken],
  )

  const handleSavePlan = useCallback(async () => {
    if (!plan || !onSavePlan) return
    setSavingPlan(true)
    try {
      await onSavePlan(plan)
    } finally {
      setSavingPlan(false)
    }
  }, [plan, onSavePlan])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkle weight="fill" className="size-4 text-primary" />
            Night Concierge
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div ref={scrollerRef} className="space-y-3 px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Describe the night, I'll draft a plan.
                </p>
                <div className="flex flex-wrap gap-2">
                  {samplePrompts.map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal py-1.5 text-left text-xs"
                      onClick={() => send(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {m.text}
                    </div>
                  </div>
                )
              }
              if (m.role === 'assistant') {
                return (
                  <div key={m.id} className="flex flex-col gap-2">
                    {m.toolCalls.map((tc, idx) => (
                      <div
                        key={`${m.id}-tool-${idx}`}
                        className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
                      >
                        <Wrench className="size-3" />
                        <span className="font-mono">{tc.name}</span>
                        <Badge variant="outline" className="text-[10px]">tool</Badge>
                      </div>
                    ))}
                    {m.text && (
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
                        {m.text}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <p key={m.id} className="text-center text-xs text-muted-foreground">
                  {m.text}
                </p>
              )
            })}

            {plan && (
              <PlanPreviewCard
                plan={plan}
                saving={savingPlan}
                onSave={handleSavePlan}
                onRefine={() => send('Refine: make it a bit cheaper and end earlier')}
                onShare={() => onShareWithCrew?.(plan)}
              />
            )}

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </ScrollArea>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Tell me about the night…"
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || input.trim().length === 0} aria-label="Send">
            <PaperPlaneTilt weight="fill" className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
