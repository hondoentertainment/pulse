/**
 * Quick-pulse draft persistence. Composer state survives dismiss, refresh,
 * and offline so "draft never lost".
 */

import type { EnergyRating } from './types'

export const PULSE_DRAFT_STORAGE_KEY = 'pulse_quick_draft_v1'
export const PULSE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
export const QUICK_PULSE_CAPTION_MAX = 120

export interface PulseDraft {
  venueId: string
  energyRating: EnergyRating
  caption: string
  updatedAt: string
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function isPulseDraftFresh(draft: PulseDraft, nowMs: number = Date.now()): boolean {
  const updated = new Date(draft.updatedAt).getTime()
  return Number.isFinite(updated) && nowMs - updated <= PULSE_DRAFT_TTL_MS && nowMs - updated >= 0
}

export function readPulseDraft(store: Storage | null = storage()): PulseDraft | null {
  if (!store) return null
  try {
    const raw = store.getItem(PULSE_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PulseDraft
    if (!parsed?.venueId || !parsed.energyRating) return null
    if (!isPulseDraftFresh(parsed)) {
      store.removeItem(PULSE_DRAFT_STORAGE_KEY)
      return null
    }
    return {
      venueId: parsed.venueId,
      energyRating: parsed.energyRating,
      caption: typeof parsed.caption === 'string' ? parsed.caption.slice(0, QUICK_PULSE_CAPTION_MAX) : '',
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

export function writePulseDraft(
  draft: Omit<PulseDraft, 'updatedAt'> & { updatedAt?: string },
  store: Storage | null = storage(),
  nowMs: number = Date.now(),
): PulseDraft {
  const next: PulseDraft = {
    venueId: draft.venueId,
    energyRating: draft.energyRating,
    caption: (draft.caption ?? '').slice(0, QUICK_PULSE_CAPTION_MAX),
    updatedAt: draft.updatedAt ?? new Date(nowMs).toISOString(),
  }
  store?.setItem(PULSE_DRAFT_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearPulseDraft(store: Storage | null = storage()): void {
  store?.removeItem(PULSE_DRAFT_STORAGE_KEY)
}

export function draftSnippet(draft: PulseDraft | null): string {
  if (!draft) return ''
  const caption = draft.caption.trim()
  if (!caption) return `${draft.energyRating} · will post when online`
  const clipped = caption.length > 28 ? `${caption.slice(0, 27)}…` : caption
  return `“${clipped}” · will post when online`
}
