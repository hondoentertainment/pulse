/**
 * GET|POST /api/signal/reminders/dispatch
 * Vercel cron: send daily Signal reminders only when today is still unlogged.
 *
 * Production (2026-09-01) crashed at boot with:
 *   ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/api/_lib/push'
 *   imported from /var/task/api/signal/reminders/dispatch.js
 *
 * Root package.json is `"type": "module"`. Node ESM does not resolve
 * extensionless relative specifiers, so a static `from '../../_lib/push'`
 * exits the process during module link — before `isCronAuthorized` can
 * return 401. This file has no static runtime relative imports. Auth and
 * 401 are inlined. Shared helpers load after auth via explicit `.js`
 * specifiers (with a `.ts` fallback for lambdas that ship sources).
 */
import type { RequestLike, ResponseLike } from '../../_lib/http.js'

function setCors(res: ResponseLike): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
}

/** Keep in sync with `isCronAuthorized` in api/_lib/signal-reminders.ts. */
function isCronAuthorized(req: RequestLike): boolean {
  const required = process.env.CRON_SECRET
  if (!required) return process.env.NODE_ENV !== 'production'
  const header = req.headers?.authorization
  const token = Array.isArray(header) ? header[0] : header
  const querySecret = Array.isArray(req.query?.secret) ? req.query?.secret[0] : req.query?.secret
  return token === `Bearer ${required}` || querySecret === required
}

function isModuleNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ERR_MODULE_NOT_FOUND')
}

async function importAfterAuth<T>(jsSpecifier: Promise<T>, tsFallback: () => Promise<T>): Promise<T> {
  try {
    return await jsSpecifier
  } catch (error) {
    if (!isModuleNotFound(error)) throw error
    return await tsFallback()
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!isCronAuthorized(req)) {
    res.status(401).json({ error: 'Invalid cron secret' })
    return
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!serviceRoleKey) {
    res.status(200).json({ data: { dispatched: 0, logOnly: true, reason: 'supabase_unconfigured' } })
    return
  }

  const { createAdminClient } = await importAfterAuth(
    import('../../_lib/supabase-server.js'),
    () => import('../../_lib/supabase-server.ts'),
  )
  const admin = createAdminClient()
  if (!admin) {
    res.status(200).json({ data: { dispatched: 0, logOnly: true, reason: 'supabase_unconfigured' } })
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

  const { selectReminderRecipients } = await importAfterAuth(
    import('../../_lib/signal-reminders.js'),
    () => import('../../_lib/signal-reminders.ts'),
  )
  const recipients = selectReminderRecipients({
    profiles: profiles ?? [],
    logged: logged ?? [],
    now: new Date(),
  })

  if (recipients.length === 0) {
    res.status(200).json({ data: { candidates: 0, results: [] } })
    return
  }

  const [{ sendPushToUser }, { sendWebPushToUser }] = await Promise.all([
    importAfterAuth(import('../../_lib/push.js'), () => import('../../_lib/push.ts')),
    importAfterAuth(import('../../_lib/web-push.js'), () => import('../../_lib/web-push.ts')),
  ])

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

  res.status(200).json({ data: { candidates: recipients.length, results } })
}
