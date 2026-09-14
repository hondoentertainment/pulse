import { repliesForPulse, PULSE_REPLY_BODY, PULSE_REPLY_CTA, type PulseReply } from '@/lib/pulse-thread'
import { SAME_CTA, formatSameCount, viewerAgreed, canSamePulse, type PulseAgree } from '@/lib/pulse-same'
import { BLOCK_PERSON_CTA } from '@/lib/user-block'
import type { DoorChip } from '@/lib/door-chips'

interface PulseThreadActionsProps {
  pulseId: string
  venueId: string
  authorUserId?: string
  viewerId?: string | null
  doorChips?: readonly DoorChip[]
  replies?: readonly PulseReply[]
  agrees?: readonly PulseAgree[]
  agreeCount?: number
  onReply?: (pulseId: string) => void
  onSame?: (pulseId: string) => void
  onBlock?: (userId: string) => void
}

export function PulseThreadActions({
  pulseId,
  venueId: _venueId,
  authorUserId,
  viewerId,
  doorChips,
  replies = [],
  agrees = [],
  agreeCount,
  onReply,
  onSame,
  onBlock,
}: PulseThreadActionsProps) {
  const thread = repliesForPulse(replies, pulseId)
  const count = agreeCount ?? agrees.filter((row) => row.pulseId === pulseId).length
  const agreed = viewerAgreed(agrees, pulseId, viewerId)
  const showSame = canSamePulse(doorChips)

  return (
    <div className="space-y-1.5 pb-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold text-foreground"
          onClick={() => onReply?.(pulseId)}
        >
          {PULSE_REPLY_CTA}
        </button>
        {showSame && (
          <button
            type="button"
            className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold text-foreground"
            aria-pressed={agreed}
            onClick={() => onSame?.(pulseId)}
          >
            {SAME_CTA} {formatSameCount(count)}
          </button>
        )}
        {onBlock && authorUserId && authorUserId !== viewerId && (
          <button
            type="button"
            className="h-8 rounded-full border border-border px-3 text-[12px] font-semibold text-muted-foreground"
            onClick={() => onBlock(authorUserId)}
          >
            {BLOCK_PERSON_CTA}
          </button>
        )}
      </div>
      {thread.length > 0 && (
        <ul className="space-y-0.5" aria-label="Pulse replies">
          {thread.map((reply) => (
            <li key={reply.id} className="text-[13px] text-muted-foreground">
              {reply.body || PULSE_REPLY_BODY}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
