/**
 * Shared tonight-digest / quiet-night cron logic.
 * Uses existing CRON_SECRET only. Missing secret or VAPID = honest no-op.
 */

import { buildTonightDigest, isTonightDigestHour, type TonightDigestResult } from './tonight-digest'
import { buildQuietNightNote, isQuietNightHour, isSurgingEmpty, type QuietNightNote } from './quiet-night'
import type { Pulse, Venue } from './types'

export interface CronNightCoachEnv {
  CRON_SECRET?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
}

export interface CronNightCoachAuth {
  authorized: boolean
  noop: boolean
  reason?: 'missing_secret' | 'unauthorized' | 'ok'
}

export function authorizeCronNightCoach(
  input: { authorization?: string | null; cronSecretHeader?: string | null },
  env: CronNightCoachEnv = {},
): CronNightCoachAuth {
  const expected = env.CRON_SECRET?.trim()
  if (!expected) {
    return { authorized: false, noop: true, reason: 'missing_secret' }
  }
  if (input.authorization === `Bearer ${expected}`) {
    return { authorized: true, noop: false, reason: 'ok' }
  }
  if (input.cronSecretHeader === expected) {
    return { authorized: true, noop: false, reason: 'ok' }
  }
  return { authorized: false, noop: false, reason: 'unauthorized' }
}

export function hasCronVapid(env: CronNightCoachEnv = {}): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim())
}

export function planNightCoachJob(input: {
  now?: Date
  venues: readonly Venue[]
  pulses: readonly Pulse[]
  followedVenueIds: readonly string[]
}): {
  digest: TonightDigestResult | null
  quiet: QuietNightNote | null
} {
  const now = input.now ?? new Date()
  const digest = isTonightDigestHour(now)
    ? buildTonightDigest({
      venues: input.venues,
      pulses: input.pulses,
      followedVenueIds: input.followedVenueIds,
      now,
    })
    : null
  const quiet = isQuietNightHour(now) && isSurgingEmpty(input.pulses, now.getTime())
    ? buildQuietNightNote({
      venues: input.venues,
      pulses: input.pulses,
      followedVenueIds: input.followedVenueIds,
      now,
    })
    : null
  return { digest, quiet }
}

export function cronNightCoachNoopPayload(reason: 'missing_secret' | 'missing_admin' | 'off_hour') {
  return {
    ok: true,
    noop: true,
    reason,
    push: 'skipped',
  }
}
