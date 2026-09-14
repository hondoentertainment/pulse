/**
 * Same — one-tap agree on a pulse (line / cover / energy).
 * Show count only. One row per user per pulse. Guest → /auth.
 */

import { sanitizeDoorChips, type DoorChip } from './door-chips'
import { buildAuthPath } from './auth-return-intent'

export const SAME_CTA = 'Same'
export const SAME_EMPTY_COUNT = 0

export interface PulseAgree {
  pulseId: string
  userId: string
  createdAt: string
}

export function canSamePulse(chips: readonly DoorChip[] | undefined): boolean {
  return sanitizeDoorChips(chips).length > 0
}

export function toggleSameAgree(
  agrees: readonly PulseAgree[],
  pulseId: string,
  userId: string,
  nowIso?: string,
): PulseAgree[] {
  const has = agrees.some((row) => row.pulseId === pulseId && row.userId === userId)
  if (has) {
    return agrees.filter((row) => !(row.pulseId === pulseId && row.userId === userId))
  }
  return [...agrees, {
    pulseId,
    userId,
    createdAt: nowIso ?? new Date().toISOString(),
  }]
}

export function sameCountForPulse(
  agrees: readonly PulseAgree[],
  pulseId: string,
): number {
  return agrees.filter((row) => row.pulseId === pulseId).length
}

export function viewerAgreed(
  agrees: readonly PulseAgree[],
  pulseId: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false
  return agrees.some((row) => row.pulseId === pulseId && row.userId === userId)
}

/** Guests see the number only — never a social graph. */
export function formatSameCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return String(n)
}

export function sameAuthPath(venueId: string, pulseId: string): string {
  return buildAuthPath(`/venue/${encodeURIComponent(venueId)}?same=${encodeURIComponent(pulseId)}`)
}
