/**
 * GET /api/signal/reminders/dispatch
 * Vercel cron: send daily Signal reminders only when today is still unlogged.
 */
import { sendPushToUser } from '../../_lib/push'
import { createAdminClient } from '../../_lib/supabase-server'
import { isCronAuthorized, selectReminderRecipients } from '../../_lib/signal-reminders'
import { sendWebPushToUser } from '../../_lib/web-push'
import { handlePreflight, methodNotAllowed, ok, unauthorized, type RequestLike, type ResponseLike } from '../../_lib/http'

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    methodNotAllowed(res, ['GET', 'POST', 'OPTIONS'])
    return
  }
  if (!isCronAuthorized(req)) {
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

  const results = await Promise.all(
    recipients.map(async (recipient) => {
      const message = {
        userId: recipient.userId,
        title: 'Pulse Signal',
        body: 'Take 10 seconds to log today’s signal.',
        data: { kind: 'signal_reminder', dayKey: recipient.dayKey },
      }
      const [native, web] = await Promise.all([
        sendPushToUser(message),
        sendWebPushToUser(message),
      ])
      return {
        userId: recipient.userId,
        native,
        web,
        dispatched: native.dispatched + web.dispatched,
        skipped: native.skipped + web.skipped,
        logOnly: native.logOnly && web.logOnly,
        errors: [...native.errors, ...web.errors],
      }
    }),
  )

  ok(res, { candidates: recipients.length, results })
}
