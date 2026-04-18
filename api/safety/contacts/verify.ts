/**
 * POST /api/safety/contacts/verify
 *
 * Generates a 6-digit OTP (TTL 10m), stores its SHA-256 hash in
 * `contact_verification_codes`, and SMSes the code to the contact.
 *
 * Body:
 *   contactId: string
 */

import { generateOtpCode, hashOtpCode, sendSms } from '../../_lib/notify'
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

type VerifyBody = { contactId?: string }

const CODE_TTL_MINUTES = 10

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

  const body = readJsonBody<VerifyBody>(req)
  if (!body?.contactId) {
    badRequest(res, 'invalid-body')
    return
  }

  const client = getServiceClient()
  if (!client) {
    res.status(200).json({ data: { ok: true, devFallback: true } })
    return
  }

  const { data: contact, error: contactError } = await client
    .from('emergency_contacts')
    .select('id, user_id, phone_e164, name')
    .eq('id', body.contactId)
    .eq('user_id', userId)
    .single()

  if (contactError || !contact) {
    res.status(404).json({ error: 'contact-not-found' })
    return
  }

  const code = generateOtpCode()
  const codeHash = await hashOtpCode(code)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  const { error: insertError } = await client.from('contact_verification_codes').insert({
    contact_id: contact.id,
    user_id: userId,
    code_hash: codeHash,
    expires_at: expiresAt,
  })
  if (insertError) {
    serverError(res, insertError.message)
    return
  }

  const smsResult = await sendSms({
    to: contact.phone_e164,
    body: `Pulse: ${contact.name}, your verification code is ${code}. Expires in ${CODE_TTL_MINUTES} minutes.`,
  })

  res.status(200).json({
    data: {
      ok: smsResult.ok,
      provider: smsResult.provider,
      expiresAt,
    },
  })
}
