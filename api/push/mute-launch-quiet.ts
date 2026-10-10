/**
 * POST /api/push/mute-launch-quiet { cityKey }
 * Signed-in follower mutes quiet-night prompts for one launched city.
 */

import {
  handlePreflight,
  methodNotAllowed,
  ok,
  fail,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { requireAuth } from '../_lib/auth.js'
import { isPlainObject } from '../_lib/validate.js'
import { createUserClient } from '../_lib/supabase-server.js'
import { coastCityByKey, DEFAULT_COAST_CITY_KEY } from '../../src/lib/coast-cities.js'

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }
  const auth = requireAuth(req)
  if (!auth.ok) {
    fail(res, auth.status, auth.code, auth.message)
    return
  }
  if (!isPlainObject(req.body)) {
    fail(res, 400, 'invalid_body', 'Request body must be a JSON object')
    return
  }
  const raw = typeof req.body.cityKey === 'string' ? req.body.cityKey : ''
  const city = coastCityByKey(raw)
  if (!city || city.key === DEFAULT_COAST_CITY_KEY) {
    fail(res, 400, 'invalid_input', 'cityKey must be a launched city other than Seattle')
    return
  }
  const client = createUserClient(auth.context.token)
  const { error } = await client.from('launch_quiet_mutes').upsert({
    user_id: auth.context.userId,
    city_key: city.key,
    muted_at: new Date().toISOString(),
  })
  if (error) {
    fail(res, 500, 'mute_failed', error.message)
    return
  }
  ok(res, { muted: true, cityKey: city.key })
}
