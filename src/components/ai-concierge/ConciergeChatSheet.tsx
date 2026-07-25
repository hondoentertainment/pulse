import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, PaperPlaneTilt, Sparkle, Wrench, X } from '@phosphor-icons/react'
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
import { Platform } from '@/lib/platform/platform'
import { preparePulsePhoto, type PreparedPulsePhoto } from '@/lib/vibe-photo-flow'
import { track } from '@/lib/observability/analytics'
import { toast } from 'sonner'

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
  | { id: string; role: 'user'; text: string; photoPreview?: string }
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
  const [pendingPhoto, setPendingPhoto] = useState<PreparedPulsePhoto | null>(null)
  const [attachingPhoto, setAttachingPhoto] = useState(false)
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

  const attachPhoto = useCallback(async () => {
    if (attachingPhoto || sending) return
    const picked = await Platform.camera.pick({ source: 'prompt', quality: 70 })
    if (!picked?.dataUrl) return
    setAttachingPhoto(true)
    try {
      const prepared = await preparePulsePhoto({
        dataUrl: picked.dataUrl,
        format: picked.format,
        blob: picked.blob,
      })
      setPendingPhoto(prepared)
      track('concierge_photo_attached', {
        sessionId,
        uploaded: Boolean(prepared.storageKey),
      })
      toast.success(prepared.storageKey ? 'Photo attached' : 'Photo attached (local)')
    } catch {
      toast.error('Could not attach photo')
    } finally {
      setAttachingPhoto(false)
    }
  }, [attachingPhoto, sending, sessionId])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      const photo = pendingPhoto
      if ((!trimmed && !photo) || sending) return
      setSending(true)
      setError(null)

      const photoHint = photo
        ? photo.storageKey
          ? `[Attached venue photo — storageKey: ${photo.storageKey}. Call assess_venue_photo with this storageKey to read the vibe.]`
          : photo.publicUrl
            ? `[Attached venue photo — imageUrl: ${photo.publicUrl}. Call assess_venue_photo with this imageUrl.]`
            : '[Attached a venue photo but upload failed; ask the user for a public image URL to assess_venue_photo.]'
        : ''

      const content = [trimmed, photoHint].filter(Boolean).join('\n\n')
      const userMsg: UiMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: trimmed || 'What vibe is this photo?',
        photoPreview: photo?.previewUrl,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setPendingPhoto(null)

      const apiMessages = [
        ...messages
          .filter((m): m is Extract<UiMessage, { role: 'user' | 'assistant' }> =>
            m.role === 'user' || m.role === 'assistant',
          )
          .map((m) => ({ role: m.role, content: m.text })),
        { role: 'user' as const, content },
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
    [messages, sending, sessionId, userLocation, authToken, pendingPhoto],
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
                    <div className="max-w-[80%] space-y-2">
                      {m.photoPreview && (
                        <img
                          src={m.photoPreview}
                          alt="Attached venue"
                          className="ml-auto h-28 w-28 rounded-xl object-cover"
                        />
                      )}
                      <div className="rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {m.text}
                      </div>
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

        {pendingPhoto && (
          <div className="flex items-center gap-2 border-t px-3 pt-2">
            <img
              src={pendingPhoto.previewUrl}
              alt="Pending attach"
              className="h-12 w-12 rounded-md object-cover"
            />
            <p className="flex-1 text-xs text-muted-foreground">
              Photo ready — send to assess vibe
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove photo"
              onClick={() => setPendingPhoto(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={sending || attachingPhoto}
            aria-label="Attach venue photo"
            onClick={() => void attachPhoto()}
          >
            <Camera weight="fill" className="size-4" />
          </Button>
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
          <Button
            type="submit"
            size="icon"
            disabled={sending || (input.trim().length === 0 && !pendingPhoto)}
            aria-label="Send"
          >
            <PaperPlaneTilt weight="fill" className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
