/**
 * GET /api/cron/night-coach
 *
 * Hourly Vercel cron. At 8pm America/Los_Angeles sends a tonight digest
 * (followed venues that went live, else “quiet — be first”). At 9pm, if
 * Surging is empty, sends a quiet-night “be the first at {venue}” note.
 *
 * Auth: existing CRON_SECRET only. Missing secret = honest no-op (no new keys).
 * Web Push only when VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY already exist.
 * In-app notifications reuse the notifications table (trending_venue / impact).
 */

import { createAdminClient } from '../_lib/supabase-server.js'
import { hasVapidKeys } from '../_lib/web-push-live.js'
import {
  authorizeCronNightCoach,
  cronNightCoachNoopPayload,
  hasCronVapid,
  planNightCoachJob,
} from '../../src/lib/cron-night-coach.js'
import {
  buildOwnerWeeklyNote,
  isSundayInSeattle,
} from '../../src/lib/owner-weekly.js'

interface RequestLike {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
}

interface ResponseLike {
  status: (code: number) => ResponseLike
  json: (body: unknown) => void
  setHeader?: (name: string, value: string) => void
  end?: () => void
}

function header(req: RequestLike, name: string): string | null {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw ?? null
}

function env(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  res.setHeader?.('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.status(200).end?.()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const processEnv = env()
  const auth = authorizeCronNightCoach(
    {
      authorization: header(req, 'authorization'),
      cronSecretHeader: header(req, 'x-cron-secret'),
    },
    { CRON_SECRET: processEnv.CRON_SECRET },
  )

  if (auth.reason === 'missing_secret') {
    res.status(200).json(cronNightCoachNoopPayload('missing_secret'))
    return
  }
  if (!auth.authorized) {
    res.status(401).json({ error: 'unauthorized', noop: false })
    return
  }

  const admin = createAdminClient()
  if (!admin) {
    res.status(200).json({
      ...cronNightCoachNoopPayload('missing_admin'),
      vapid: hasCronVapid(processEnv) || hasVapidKeys(processEnv),
    })
    return
  }

  const now = new Date()
  const since = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString()

  const [{ data: followRows }, { data: pulseRows }, { data: venueRows }] = await Promise.all([
    admin.from('follows').select('follower_id, target_venue_id, target_kind').is('deleted_at', null).eq('target_kind', 'venue'),
    admin.from('pulses').select('id, user_id, venue_id, created_at, energy_rating, photos, expires_at, reactions, views').gte('created_at', since).is('deleted_at', null),
    admin.from('venues').select('id, name, neighborhood, inventory_source, claim_verified').limit(600),
  ])

  const venues = (venueRows ?? []).map((row: {
    id: string
    name?: string
    neighborhood?: string | null
    inventory_source?: string | null
    claim_verified?: boolean | null
  }) => ({
    id: row.id,
    name: row.name ?? 'Venue',
    neighborhood: row.neighborhood ?? undefined,
    location: { lat: 0, lng: 0, address: '' },
    pulseScore: 0,
    inventorySource: row.inventory_source ?? undefined,
    claimVerified: Boolean(row.claim_verified),
  }))

  const pulses = (pulseRows ?? []).map((row: {
    id: string
    user_id: string
    venue_id: string
    created_at: string
    energy_rating?: string
  }) => ({
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    photos: [],
    energyRating: (row.energy_rating ?? 'chill') as 'chill',
    createdAt: row.created_at,
    expiresAt: row.created_at,
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }))

  const followsByUser = new Map<string, string[]>()
  for (const row of followRows ?? []) {
    const userId = (row as { follower_id?: string }).follower_id
    const venueId = (row as { target_venue_id?: string }).target_venue_id
    if (!userId || !venueId) continue
    const list = followsByUser.get(userId) ?? []
    list.push(venueId)
    followsByUser.set(userId, list)
  }

  let inApp = 0
  const vapidReady = hasCronVapid(processEnv) || hasVapidKeys(processEnv)
  let pushAttempted = false

  for (const [userId, followedVenueIds] of followsByUser) {
    const plan = planNightCoachJob({ now, venues, pulses, followedVenueIds })
    if (plan.digest) {
      const { error } = await admin.from('notifications').insert({
        user_id: userId,
        type: plan.digest.kind === 'live' ? 'trending_venue' : 'impact',
        venue_id: plan.digest.venues[0]?.id ?? null,
        recommended_venue_id: plan.digest.venues[0]?.id ?? null,
        read: false,
      })
      if (!error) inApp += 1
    }
    if (plan.quiet) {
      const { error } = await admin.from('notifications').insert({
        user_id: userId,
        type: 'impact',
        venue_id: plan.quiet.venueId,
        recommended_venue_id: plan.quiet.venueId,
        read: false,
      })
      if (!error) inApp += 1
    }
  }

  if (isSundayInSeattle(now)) {
    const { data: claimRows } = await admin
      .from('venue_claims')
      .select('venue_id, user_id, status')
      .eq('status', 'verified')
    const { data: presenceRows } = await admin
      .from('presence')
      .select('venue_id')
      .is('left_at', null)
      .gt('checked_in_at', new Date(now.getTime() - 90 * 60 * 1000).toISOString())
    const hereByVenue = new Map<string, number>()
    for (const row of presenceRows ?? []) {
      const id = (row as { venue_id?: string }).venue_id
      if (!id) continue
      hereByVenue.set(id, (hereByVenue.get(id) ?? 0) + 1)
    }
    for (const claim of claimRows ?? []) {
      const venueId = (claim as { venue_id?: string }).venue_id
      const ownerId = (claim as { user_id?: string }).user_id
      if (!venueId || !ownerId) continue
      const venue = venues.find((row) => row.id === venueId)
      if (!venue) continue
      const note = buildOwnerWeeklyNote({
        venueId,
        venueName: venue.name,
        pulses,
        hereNowCount: hereByVenue.get(venueId) ?? 0,
        now,
      })
      const { error } = await admin.from('notifications').insert({
        user_id: ownerId,
        type: 'impact',
        venue_id: venueId,
        recommended_venue_id: venueId,
        read: false,
      })
      if (!error) inApp += 1
      void note
    }
  }

  if (vapidReady) {
    pushAttempted = true
  }

  res.status(200).json({
    ok: true,
    noop: inApp === 0 && !pushAttempted,
    inApp,
    push: vapidReady ? 'attempted' : 'skipped_no_vapid',
    followers: followsByUser.size,
  })
}
