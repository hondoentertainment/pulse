/**
 * GET /api/account/notification-settings — read prefs (JWT + RLS)
 * PATCH /api/account/notification-settings — partial update (JWT + RLS)
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http'
import { verifySupabaseJwt, extractBearer } from '../_lib/auth'
import { createUserClient } from '../_lib/supabase-server'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  mergeNotificationSettings,
  parseNotificationSettingsPatch,
} from '../_lib/notification-settings'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return

  const auth = await verifySupabaseJwt(req)
  if (!auth.ok || !auth.user) {
    fail(res, 401, 'unauthenticated', auth.error ?? 'Authentication required')
    return
  }

  const token = extractBearer(req)
  if (!token) {
    fail(res, 401, 'unauthenticated', 'Missing bearer token')
    return
  }

  const client = createUserClient(token)

  if (req.method === 'GET') {
    const { data, error } = await client
      .from('profiles')
      .select('notification_settings')
      .eq('id', auth.user.id)
      .maybeSingle()

    if (error) {
      fail(res, 500, 'read_failed', error.message)
      return
    }

    ok(res, mergeNotificationSettings(data?.notification_settings ?? DEFAULT_NOTIFICATION_SETTINGS))
    return
  }

  if (req.method === 'PATCH') {
    const parsed = parseNotificationSettingsPatch(req.body)
    if (!parsed.ok) {
      fail(res, 400, 'invalid_input', parsed.error)
      return
    }

    const { data: existing, error: readErr } = await client
      .from('profiles')
      .select('notification_settings')
      .eq('id', auth.user.id)
      .maybeSingle()

    if (readErr) {
      fail(res, 500, 'read_failed', readErr.message)
      return
    }

    const merged = {
      ...mergeNotificationSettings(existing?.notification_settings),
      ...parsed.patch,
    }

    const { error: updateErr } = await client
      .from('profiles')
      .update({ notification_settings: merged })
      .eq('id', auth.user.id)

    if (updateErr) {
      fail(res, 500, 'update_failed', updateErr.message)
      return
    }

    ok(res, merged)
    return
  }

  methodNotAllowed(res, ['GET', 'PATCH', 'OPTIONS'])
}
