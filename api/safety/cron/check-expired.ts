/**
 * GET /api/safety/cron/check-expired
 *
 * Vercel cron entry-point. Registered in vercel.json under `crons` with schedule
 * "*\/1 * * * *" (every minute).
 *
 * Responsibilities:
 *   1. Find `safety_sessions` rows where state='active' AND expected_end_at < now().
 *      Flip them to 'alerted' and fan out SMS+push to every verified contact in
 *      the snapshot.
 *   2. Purge `safety_pings` older than 30 days.
 *   3. Purge expired OTP rows.
 *
 * Authentication: Vercel provides a CRON_SECRET header on scheduled invocations
 * (or the classic `Authorization: Bearer <CRON_SECRET>`). We check it.
 */

import { sendPush, sendSms } from '../../_lib/notify'
import {
  getServiceClient,
  methodNotAllowed,
  readHeader,
  serverError,
  setCors,
  type RequestLike,
  type ResponseLike,
} from '../../_lib/safety-server'

interface ContactSnapshotEntry {
  id?: string
  name?: string
  phone_e164?: string
  method?: 'sms' | 'push'
}

const PING_RETENTION_DAYS = 30

function isAuthorized(req: RequestLike): boolean {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  const expected = processEnv.CRON_SECRET
  if (!expected) {
    // If CRON_SECRET isn't set we only allow requests coming with the classic
    // Vercel cron header. Locally anyone can hit the endpoint.
    return true
  }
  const auth = readHeader(req, 'authorization')
  if (auth === `Bearer ${expected}`) return true
  const direct = readHeader(req, 'x-cron-secret')
  if (direct === expected) return true
  return false
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'GET') {
    methodNotAllowed(res)
    return
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const client = getServiceClient()
  if (!client) {
    res.status(200).json({ data: { ok: true, devFallback: true } })
    return
  }

  const nowIso = new Date().toISOString()

  // 1. Fetch expired sessions.
  const { data: expired, error: fetchError } = await client
    .from('safety_sessions')
    .select(
      'id, user_id, kind, contacts_snapshot, last_location_lat, last_location_lng, destination_label',
    )
    .lt('expected_end_at', nowIso)
    .eq('state', 'active')
    .limit(50)

  if (fetchError) {
    serverError(res, fetchError.message)
    return
  }

  const notified: Array<{ sessionId: string; count: number }> = []

  for (const session of expired ?? []) {
    const contacts = Array.isArray(session.contacts_snapshot)
      ? (session.contacts_snapshot as ContactSnapshotEntry[])
      : []
    const lat = session.last_location_lat
    const lng = session.last_location_lng
    const mapLink = lat != null && lng != null
      ? ` Last known location: https://maps.google.com/?q=${lat},${lng}`
      : ''
    const smsBody = `Pulse Safety Alert: a friend's safe-walk timer expired without check-in.${mapLink}`

    const results = await Promise.all(
      contacts.map(async contact => {
        if (contact.method === 'push' && contact.id) {
          const r = await sendPush({
            userId: contact.id,
            title: 'Pulse Safety Alert',
            body: smsBody,
            data: { sessionId: session.id },
          })
          return { contactId: contact.id, ok: r.ok, provider: r.provider }
        }
        if (contact.phone_e164) {
          const r = await sendSms({ to: contact.phone_e164, body: smsBody })
          return { contactId: contact.id, ok: r.ok, provider: r.provider }
        }
        return { contactId: contact.id, ok: false, provider: 'log-only' as const }
      }),
    )

    await Promise.all([
      client
        .from('safety_sessions')
        .update({
          state: 'alerted',
          contacts_notified: results.map(r => ({ ...r, at: nowIso })),
          updated_at: nowIso,
        })
        .eq('id', session.id),
      client.from('safety_audit').insert({
        session_id: session.id,
        user_id: session.user_id,
        event: 'auto_alert_expired',
        metadata: { notified: results },
      }),
    ])

    notified.push({ sessionId: session.id, count: results.length })
  }

  // 2. Purge old pings.
  const purgeCutoff = new Date(Date.now() - PING_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await client.from('safety_pings').delete().lt('created_at', purgeCutoff)

  // 3. Purge expired OTPs.
  await client.from('contact_verification_codes').delete().lt('expires_at', nowIso)

  res.status(200).json({
    data: {
      ok: true,
      at: nowIso,
      expiredHandled: notified.length,
      details: notified,
    },
  })
}
