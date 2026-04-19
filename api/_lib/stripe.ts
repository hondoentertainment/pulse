/**
 * Stripe REST client — thin `fetch` wrapper, no SDK.
 *
 * Keeps Edge Function bundles small and avoids the Node-only `stripe` SDK.
 * Covers the surface the ticketing / reservations flows need:
 *   - createPaymentIntent (with optional Connect transfer_data + application_fee)
 *   - retrievePaymentIntent
 *   - createRefund
 *   - createConnectedAccount (Express)
 *   - createAccountLink (onboarding)
 *   - verifyWebhookSignature (Stripe-Signature / t=,v1=)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET  — whsec_... (only for webhook handler)
 *   STRIPE_PUBLISHABLE_KEY — pk_... (referenced client-side only; documented here)
 *
 * Fee model: platform takes a configurable percentage; configured via
 * `PLATFORM_FEE_BPS` (basis points, default 1000 = 10%). All amounts are
 * integer cents in the currency specified at intent creation.
 */

const STRIPE_API = 'https://api.stripe.com/v1'

type StripeInitOptions = {
  secretKey?: string
  apiVersion?: string
}

function getSecretKey(override?: string): string {
  const key = override ?? process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return key
}

/** Encode an arbitrarily-nested object into Stripe's `form-urlencoded` shape. */
export function encodeStripeForm(
  body: Record<string, unknown>,
  prefix = '',
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object' && v !== null) {
          const nested = encodeStripeForm(v as Record<string, unknown>, `${fullKey}[${i}]`)
          nested.forEach((nv, nk) => params.append(nk, nv))
        } else {
          params.append(`${fullKey}[${i}]`, String(v))
        }
      })
    } else if (typeof value === 'object') {
      const nested = encodeStripeForm(value as Record<string, unknown>, fullKey)
      nested.forEach((nv, nk) => params.append(nk, nv))
    } else {
      params.append(fullKey, String(value))
    }
  }
  return params
}

async function stripeFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: URLSearchParams } = { method: 'GET' },
  opts: StripeInitOptions = {},
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${getSecretKey(opts.secretKey)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': opts.apiVersion ?? '2024-06-20',
    },
    body: init.body,
  })
  const json = (await res.json()) as T & { error?: { message?: string; type?: string } }
  if (!res.ok) {
    const message = json?.error?.message ?? `Stripe ${res.status}`
    throw new Error(`Stripe request failed: ${message}`)
  }
  return json
}

export interface StripePaymentIntent {
  id: string
  client_secret?: string
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'succeeded'
    | 'canceled'
  amount: number
  currency: string
  metadata?: Record<string, string>
}

export interface CreatePaymentIntentArgs {
  amountCents: number
  currency: string
  /** Platform fee in cents, taken from the charge (destination charge model). */
  applicationFeeCents?: number
  /** Connected account (acct_...) to receive the funds. */
  onBehalfOfAccountId?: string
  /** Destination account id (acct_...) for transfer_data[destination]. */
  destinationAccountId?: string
  metadata?: Record<string, string>
  /** Restrict to card-only until full method support is wired. */
  paymentMethodTypes?: string[]
  idempotencyKey?: string
}

export async function createPaymentIntent(
  args: CreatePaymentIntentArgs,
): Promise<StripePaymentIntent> {
  const body: Record<string, unknown> = {
    amount: args.amountCents,
    currency: args.currency,
    payment_method_types: args.paymentMethodTypes ?? ['card'],
  }
  if (args.applicationFeeCents) body.application_fee_amount = args.applicationFeeCents
  if (args.onBehalfOfAccountId) body.on_behalf_of = args.onBehalfOfAccountId
  if (args.destinationAccountId) {
    body.transfer_data = { destination: args.destinationAccountId }
  }
  if (args.metadata) body.metadata = args.metadata

  return stripeFetch<StripePaymentIntent>('/payment_intents', {
    method: 'POST',
    body: encodeStripeForm(body),
  })
}

export async function retrievePaymentIntent(id: string): Promise<StripePaymentIntent> {
  return stripeFetch<StripePaymentIntent>(`/payment_intents/${encodeURIComponent(id)}`, {
    method: 'GET',
  })
}

// ─── Checkout Sessions ───

export interface StripeCheckoutSessionLineItem {
  name: string
  description?: string
  amountCents: number
  currency: string
  quantity: number
}

export interface CreateCheckoutSessionArgs {
  lineItems: StripeCheckoutSessionLineItem[]
  successUrl: string
  cancelUrl: string
  clientReferenceId?: string
  customerEmail?: string
  metadata?: Record<string, string>
  mode?: 'payment' | 'subscription'
  /** Platform fee in cents (destination-charge model). */
  applicationFeeCents?: number
  /** Destination connected account id. When present Stripe routes the charge. */
  destinationAccountId?: string
  idempotencyKey?: string
}

export interface StripeCheckoutSession {
  id: string
  url: string | null
  payment_intent?: string | null
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required'
  status?: 'open' | 'complete' | 'expired'
  amount_total?: number | null
  currency?: string | null
  client_reference_id?: string | null
  metadata?: Record<string, string>
}

export async function createCheckoutSession(
  args: CreateCheckoutSessionArgs,
): Promise<StripeCheckoutSession> {
  const body: Record<string, unknown> = {
    mode: args.mode ?? 'payment',
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    line_items: args.lineItems.map(item => ({
      quantity: item.quantity,
      price_data: {
        currency: item.currency,
        unit_amount: item.amountCents,
        product_data: {
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
        },
      },
    })),
  }
  if (args.clientReferenceId) body.client_reference_id = args.clientReferenceId
  if (args.customerEmail) body.customer_email = args.customerEmail
  if (args.metadata) body.metadata = args.metadata
  if (args.applicationFeeCents || args.destinationAccountId) {
    const payment_intent_data: Record<string, unknown> = {}
    if (args.applicationFeeCents) payment_intent_data.application_fee_amount = args.applicationFeeCents
    if (args.destinationAccountId) {
      payment_intent_data.transfer_data = { destination: args.destinationAccountId }
    }
    if (args.metadata) payment_intent_data.metadata = args.metadata
    body.payment_intent_data = payment_intent_data
  }

  return stripeFetch<StripeCheckoutSession>('/checkout/sessions', {
    method: 'POST',
    body: encodeStripeForm(body),
  })
}

export async function retrieveCheckoutSession(
  id: string,
): Promise<StripeCheckoutSession> {
  return stripeFetch<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(id)}`,
    { method: 'GET' },
  )
}

/**
 * Parse a raw Stripe webhook event payload. No signature verification —
 * callers should invoke `verifyWebhookSignature` first.
 */
export interface StripeWebhookEvent<T = unknown> {
  id: string
  type: string
  data: { object: T }
  created: number
}

export function parseWebhookEvent<T = unknown>(rawBody: string): StripeWebhookEvent<T> | null {
  try {
    const parsed = JSON.parse(rawBody) as StripeWebhookEvent<T>
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return null
    if (typeof parsed.type !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export interface StripeRefund {
  id: string
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
  amount: number
  payment_intent: string
}

export async function createRefund(
  paymentIntentId: string,
  amountCents?: number,
): Promise<StripeRefund> {
  const body: Record<string, unknown> = { payment_intent: paymentIntentId }
  if (amountCents !== undefined) body.amount = amountCents
  return stripeFetch<StripeRefund>('/refunds', {
    method: 'POST',
    body: encodeStripeForm(body),
  })
}

export interface StripeConnectedAccount {
  id: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  requirements?: { disabled_reason?: string | null }
}

export async function createConnectedAccount(
  email: string,
  country = 'US',
): Promise<StripeConnectedAccount> {
  const body: Record<string, unknown> = {
    type: 'express',
    country,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  }
  return stripeFetch<StripeConnectedAccount>('/accounts', {
    method: 'POST',
    body: encodeStripeForm(body),
  })
}

export async function retrieveConnectedAccount(
  accountId: string,
): Promise<StripeConnectedAccount> {
  return stripeFetch<StripeConnectedAccount>(`/accounts/${encodeURIComponent(accountId)}`, {
    method: 'GET',
  })
}

export interface StripeAccountLink {
  url: string
  expires_at: number
}

export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<StripeAccountLink> {
  const body: Record<string, unknown> = {
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  }
  return stripeFetch<StripeAccountLink>('/account_links', {
    method: 'POST',
    body: encodeStripeForm(body),
  })
}

/**
 * Verify a Stripe webhook signature.
 *
 * Implements the `t=...,v1=...` scheme from Stripe-Signature using HMAC SHA-256.
 * Rejects payloads older than `toleranceSec` (default 300s).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  if (!signatureHeader) return false
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, ...rest] = p.split('=')
      return [k.trim(), rest.join('=')]
    }),
  )
  const timestamp = parts['t']
  const v1 = parts['v1']
  if (!timestamp || !v1) return false

  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > toleranceSec) return false

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = await hmacSha256Hex(secret, signedPayload)
  return timingSafeEqual(expected, v1)
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  // Prefer Web Crypto (Edge runtime / modern Node). Fall back to node:crypto.
  const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
  if (subtle) {
    const keyData = new TextEncoder().encode(secret)
    const msg = new TextEncoder().encode(message)
    const cryptoKey = await subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await subtle.sign('HMAC', cryptoKey, msg)
    return Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  const nodeCrypto = await import('node:crypto')
  return nodeCrypto.createHmac('sha256', secret).update(message).digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/** HMAC-based QR secret (not reversible, not a JWT — just a fingerprint). */
export async function generateQrSecret(
  ticketId: string,
  userId: string,
  serverSecret: string,
): Promise<string> {
  return hmacSha256Hex(serverSecret, `${ticketId}:${userId}`)
}
