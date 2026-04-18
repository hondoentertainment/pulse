/**
 * POST /api/safety/contacts/confirm
 *
 * Validates an OTP previously issued by /api/safety/contacts/verify and sets
 * `emergency_contacts.verified_at` on success.
 *
 * Body:
 *   contactId: string
 *   code: string (6 digits)
 */

import { hashOtpCode } from '../../_lib/notify'
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

type ConfirmBody = {
  contactId?: string
  code?: string
}

const MAX_ATTEMPTS = 5

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

  const body = readJsonBody<ConfirmBody>(req)
  if (!body?.contactId || !body.code || !/^[0-9]{6}$/.test(body.code)) {
    badRequest(res, 'invalid-body')
    return
  }

  const client = getServiceClient()
  if (!client) {
    // Dev fallback: any 6-digit code passes.
    res.status(200).json({ data: { ok: true, devFallback: true } })
    return
  }

  const { data: row, error } = await client
    .from('contact_verification_codes')
    .select('id, contact_id, code_hash, expires_at, attempts, consumed_at')
    .eq('contact_id', body.contactId)
    .eq('user_id', userId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    serverError(res, error.message)
    return
  }
  if (!row) {
    res.status(410).json({ error: 'code-expired-or-missing' })
    return
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: 'too-many-attempts' })
    return
  }

  const candidateHash = await hashOtpCode(body.code)
  const matches = candidateHash === row.code_hash

  if (!matches) {
    await client
      .from('contact_verification_codes')
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id)
    res.status(400).json({ error: 'code-mismatch' })
    return
  }

  const nowIso = new Date().toISOString()
  const [{ error: consumeError }, { error: verifyError }] = await Promise.all([
    client
      .from('contact_verification_codes')
      .update({ consumed_at: nowIso, attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id),
    client
      .from('emergency_contacts')
      .update({ verified_at: nowIso, updated_at: nowIso })
      .eq('id', body.contactId)
      .eq('user_id', userId),
  ])

  if (consumeError || verifyError) {
    serverError(res, consumeError?.message ?? verifyError?.message ?? 'update-failed')
    return
  }

  res.status(200).json({ data: { ok: true, verifiedAt: nowIso } })
}
