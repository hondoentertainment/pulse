/**
 * WC-7 admin close-out. Resolve and dismiss need a reason.
 * Owner dismiss (non-admin) may omit one. Reporter details stay separate.
 */

export type ModerationCloseStatus = 'actioned' | 'dismissed' | 'pending' | 'reviewed' | string

export type ModerationDecision =
  | { ok: true; note: string | null }
  | { ok: false; message: string }

export function moderationResolution(input: {
  admin: boolean
  status: ModerationCloseStatus
  reason?: string | null
}): ModerationDecision {
  const note = (input.reason ?? '').trim()
  const closing = input.status === 'actioned' || input.status === 'dismissed'
  if (note.length > 280) {
    return { ok: false, message: 'Reason must be 280 characters or fewer' }
  }
  if (input.admin && closing && note.length === 0) {
    return { ok: false, message: 'A reason is required to resolve or dismiss' }
  }
  return { ok: true, note: note.length > 0 ? note : null }
}
