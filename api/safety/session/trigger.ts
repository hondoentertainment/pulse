/**
 * POST /api/safety/session/trigger
 *
 * Manual panic trigger. Flips a session to `alerted` (creating one if the
 * caller did not supply a session id) and fans out SMS + push to every
 * verified contact.
 *
 * Body:
 *   sessionId?: string
 *   kind?: 'safe_walk' | 'share_night' | 'panic'   (used if sessionId missing)
 *   location?: { lat: number; lng: number }
 *   message?: string                               (optional extra note from user)
 */

import { sendPush, sendSms } from '../../_lib/notify'
import {
  authenticate,
  badRequest,
  getServiceClient,
  methodNotAllowed,
  readJsonBody,
  serverError,
  setCors,
  unauthorized,
  type RequestLike,
  type ResponseLike,
} from '../../_lib/safety-server'

type TriggerBody = {
  sessionId?: string
  kind?: 'safe_walk' | 'share_night' | 'panic'
  location?: { lat?: number; lng?: number }
  message?: string
}

interface ContactSnapshot {
  id: string
  name: string
  phone_e164: string
  method?: 'sms' | 'push'
}

function buildSmsBody(args: {
  userName: string
  location?: { lat?: number; lng?: number }
  note?: string
}): string {
  const mapLink =
    args.location?.lat != null && args.location?.lng != null
      ? ` Last known location: https://maps.google.com/?q=${args.location.lat},${args.location.lng}`
      : ''
  const note = args.note ? ` Note: ${args.note.slice(0, 120)}.` : ''
  return `Pulse Safety Alert: ${args.userName} triggered a safety alert and asked you to check on them.${mapLink}${note}`
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    methodNotAllowed(res)
    return
  }

  const userId = await authenticate(req)
  if (!userId) {
    unauthorized(res)
    return
  }

  const body = readJsonBody<TriggerBody>(req) ?? {}
  const client = getServiceClient()

  // ---- dev fallback ------------------------------------------------------
  if (!client) {
    res.status(200).json({
      data: {
        state: 'alerted',
        devFallback: true,
        notified: 0,
      },
    })
    return
  }

  // ---- fetch user + contacts --------------------------------------------
  const [{ data: profile }, { data: contacts }] = await Promise.all([
    client.from('profiles').select('id, username').eq('id', userId).single(),
    client
      .from('emergency_contacts')
      .select('id, name, phone_e164, preferred_contact_method, verified_at')
      .eq('user_id', userId)
      .not('verified_at', 'is', null),
  ])

  const userName = profile?.username ?? 'Your friend'
  const verifiedContacts: ContactSnapshot[] = (contacts ?? []).map(c => ({
    id: c.id,
    name: c.name,
    phone_e164: c.phone_e164,
    method: (c.preferred_contact_method ?? 'sms') as 'sms' | 'push',
  }))

  // ---- resolve or create the session ------------------------------------
  let sessionId = body.sessionId ?? null
  if (sessionId) {
    const { error } = await client
      .from('safety_sessions')
      .update({
        state: 'alerted',
        last_location_lat: body.location?.lat ?? null,
        last_location_lng: body.location?.lng ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
    if (error) {
      serverError(res, error.message)
      return
    }
  } else {
    const { data: created, error } = await client
      .from('safety_sessions')
      .insert({
        user_id: userId,
        kind: body.kind ?? 'panic',
        state: 'alerted',
        starts_at: new Date().toISOString(),
        last_location_lat: body.location?.lat ?? null,
        last_location_lng: body.location?.lng ?? null,
        contacts_snapshot: verifiedContacts,
      })
      .select()
      .single()
    if (error || !created) {
      serverError(res, error?.message ?? 'create-failed')
      return
    }
    sessionId = created.id
  }

  // ---- notify ------------------------------------------------------------
  const smsBody = buildSmsBody({
    userName,
    location: body.location,
    note: body.message,
  })
  const results = await Promise.all(
    verifiedContacts.map(async contact => {
      if (contact.method === 'push') {
        const push = await sendPush({
          userId: contact.id,
          title: 'Pulse Safety Alert',
          body: smsBody,
          data: { sessionId, triggeredBy: userId },
        })
        return { contactId: contact.id, ok: push.ok, provider: push.provider }
      }
      const sms = await sendSms({ to: contact.phone_e164, body: smsBody })
      return { contactId: contact.id, ok: sms.ok, provider: sms.provider }
    }),
  )

  // ---- persist audit + contacts_notified --------------------------------
  const notifiedSummary = results.map(r => ({
    contactId: r.contactId,
    provider: r.provider,
    ok: r.ok,
    at: new Date().toISOString(),
  }))

  await Promise.all([
    client
      .from('safety_sessions')
      .update({ contacts_notified: notifiedSummary, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId),
    client.from('safety_audit').insert({
      session_id: sessionId,
      user_id: userId,
      event: 'panic_trigger',
      metadata: {
        location: body.location ?? null,
        notified: notifiedSummary,
        hadSessionId: Boolean(body.sessionId),
      },
    }),
  ])

  res.status(200).json({
    data: {
      sessionId,
      state: 'alerted',
      notified: results.length,
      results,
    },
  })
}
