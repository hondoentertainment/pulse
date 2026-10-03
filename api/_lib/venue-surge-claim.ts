/**
 * One Electric surge notice per venue per 2 hours.
 * Claim the row before sending so two pulses cannot both notify.
 * A missing venue_surge_notices table stays an honest no-op.
 */

export type SurgeClaimResult = 'claimed' | 'rate_limited' | 'unavailable'

export interface SurgeNoticeError {
  code?: string
  message?: string
}

export interface SurgeNoticeWriter {
  updateIfOlder(input: {
    venueId: string
    notifiedAt: string
    pulseId: string | null
    olderThan: string
  }): Promise<{ error: SurgeNoticeError | null; rows: number }>
  insert(input: {
    venueId: string
    notifiedAt: string
    pulseId: string | null
  }): Promise<{ error: SurgeNoticeError | null }>
}

export function isSurgeNoticeMissing(error: SurgeNoticeError | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /venue_surge_notices|schema cache/i.test(error.message ?? '')
}

export function isSurgeNoticeConflict(error: SurgeNoticeError | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return /duplicate key|unique constraint/i.test(error.message ?? '')
}

export async function claimVenueSurgeNotice(
  writer: SurgeNoticeWriter,
  input: { venueId: string; pulseId: string | null; nowIso: string; cutoffIso: string },
): Promise<SurgeClaimResult> {
  const updated = await writer.updateIfOlder({
    venueId: input.venueId,
    notifiedAt: input.nowIso,
    pulseId: input.pulseId,
    olderThan: input.cutoffIso,
  })
  if (updated.error) return 'unavailable'
  if (updated.rows > 0) return 'claimed'

  const inserted = await writer.insert({
    venueId: input.venueId,
    notifiedAt: input.nowIso,
    pulseId: input.pulseId,
  })
  if (!inserted.error) return 'claimed'
  if (isSurgeNoticeConflict(inserted.error)) return 'rate_limited'
  return 'unavailable'
}
