/**
 * Client-side 8pm digest / 9pm quiet-night reminder.
 * Used when cron/VAPID is missing. Honest no-op outside those hours.
 */

import {
  buildTonightDigest,
  shouldShowTonightDigest,
  TONIGHT_DIGEST_STORAGE_KEY,
  type TonightDigestResult,
} from './tonight-digest'
import {
  buildQuietNightNote,
  isSurgingEmpty,
  QUIET_NIGHT_STORAGE_KEY,
  shouldShowQuietNight,
  type QuietNightNote,
} from './quiet-night'
import type { Pulse, Venue } from './types'

export interface LocalNightCoachNote {
  kind: 'digest' | 'quiet'
  title: string
  body: string
  venueId?: string
}

function readKey(store: Pick<Storage, 'getItem'> | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeKey(store: Pick<Storage, 'setItem'> | null, key: string, value: string): void {
  try {
    store?.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function evaluateLocalNightCoach(input: {
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds: readonly string[]
  now?: Date
  store?: Pick<Storage, 'getItem' | 'setItem'> | null
}): LocalNightCoachNote | null {
  const now = input.now ?? new Date()
  const store = input.store ?? (typeof window === 'undefined' ? null : window.localStorage)

  if (shouldShowTonightDigest({ now, lastShownDateKey: readKey(store, TONIGHT_DIGEST_STORAGE_KEY) })) {
    const digest: TonightDigestResult = buildTonightDigest({
      venues: input.venues,
      pulses: input.pulses,
      followedVenueIds: input.followedVenueIds,
      now,
    })
    writeKey(store, TONIGHT_DIGEST_STORAGE_KEY, digest.localDateKey)
    return {
      kind: 'digest',
      title: digest.title,
      body: digest.body,
      venueId: digest.venues[0]?.id,
    }
  }

  const surgingEmpty = isSurgingEmpty(input.pulses, now.getTime())
  if (shouldShowQuietNight({
    now,
    lastShownDateKey: readKey(store, QUIET_NIGHT_STORAGE_KEY),
    surgingEmpty,
  })) {
    const note: QuietNightNote | null = buildQuietNightNote({
      venues: input.venues,
      pulses: input.pulses,
      followedVenueIds: input.followedVenueIds,
      now,
    })
    if (!note) return null
    writeKey(store, QUIET_NIGHT_STORAGE_KEY, note.localDateKey)
    return {
      kind: 'quiet',
      title: note.title,
      body: note.body,
      venueId: note.venueId,
    }
  }

  return null
}
