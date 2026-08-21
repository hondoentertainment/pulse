/**
 * GET /api/signal/reminders/dispatch
 * Vercel cron: send daily Signal reminders only when today is still unlogged.
 */
import { sendPushToUser } from '../../_lib/push'
import { createAdminClient } from '../../_lib/supabase-server'
import { selectReminderRecipients } from '../../_lib/signal-reminders'
import { handlePreflight, methodNotAllowed, ok, unauthorized, type RequestLike, type ResponseLike } from '../../_lib/http'

const checkAuth = (req: RequestLike): boolean => {
  const required = process.env.CRON_SECRET
  if (!required) return true
  const header = req.headers?.authorization
  const token = Array.isArray(header) ? header[0] : header
  const querySecret = Array.isArray(req.query?.secret) ? req.query?.secret[0] : req.query?.secret
  return token === `Bearer ${required}` || querySecret === required
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    methodNotAllowed(res, ['GET', 'POST', 'OPTIONS'])
    return
  }
  if (!checkAuth(req)) {
    unauthorized(res, 'Invalid cron secret')
    return
  }

  const admin = createAdminClient()
  if (!admin) {
    ok(res, { dispatched: 0, logOnly: true, reason: 'supabase_unconfigured' })
    return
  }

  const { data: profiles } = await admin
    .from('signal_profiles')
    .select('user_id,reminder_enabled,reminder_time,reminder_timezone')
    .eq('reminder_enabled', true)

  const userIds = (profiles ?? []).map((row) => row.user_id).filter(Boolean)
  const oldestKey = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: logged } = userIds.length === 0
    ? { data: [] as Array<{ user_id: string; day_key: string }> }
    : await admin
      .from('signal_entries')
      .select('user_id,day_key')
      .in('user_id', userIds)
      .gte('day_key', oldestKey)

  const recipients = selectReminderRecipients({
    profiles: profiles ?? [],
    logged: logged ?? [],
    now: new Date(),
  })

  const results = []
  for (const recipient of recipients) {
    const result = await sendPushToUser({
      userId: recipient.userId,
      title: 'Pulse Signal',
      body: 'Take 10 seconds to log today’s signal.',
      data: { kind: 'signal_reminder', dayKey: recipient.dayKey },
    })
    results.push({ userId: recipient.userId, ...result })
  }

  ok(res, { candidates: recipients.length, results })
}
