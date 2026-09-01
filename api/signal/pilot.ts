import { getAuthenticatedUserId } from '../_lib/auth.js'
import { createAdminClient } from '../_lib/supabase-server.js'
import { clientKey, rateLimit } from '../_lib/rate-limit.js'
import { badRequest, handlePreflight, methodNotAllowed, ok, serverError, tooManyRequests, type RequestLike, type ResponseLike } from '../_lib/http.js'
import { classifyPilotPersistError, isValidPilotEmail, normalizePilotEmail } from '../../src/lib/signal-pilot.js'

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS'])
    return
  }

  const limit = rateLimit(clientKey(req, 'signal-pilot'), 8, 60_000)
  if (!limit.ok) {
    tooManyRequests(res, limit.retryAfterSeconds)
    return
  }

  const body = (req.body ?? {}) as { email?: string; source?: string }
  const email = normalizePilotEmail(body.email ?? '')
  if (!isValidPilotEmail(email)) {
    badRequest(res, 'Enter a valid email address.')
    return
  }

  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'pro_pilot'
  const userId = getAuthenticatedUserId(req)

  const admin = createAdminClient()
  if (!admin) {
    serverError(res, 'Pilot list is not configured on the server.')
    return
  }

  const { error } = await admin.from('signal_pilot_signups').insert({
    email,
    source,
    user_id: userId,
  })

  const status = classifyPilotPersistError(error)
  if (status === 'failed') {
    serverError(res, error?.message ?? 'Could not save signup')
    return
  }

  ok(res, { status, email }, status === 'already_registered' ? 200 : 201)
}
