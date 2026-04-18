/**
 * Dynamically loads Stripe.js from Stripe's CDN at usage time.
 *
 * We deliberately do NOT bundle `@stripe/stripe-js`. The official pattern
 * requires loading from js.stripe.com for PCI compliance, so we inject a
 * <script> tag on-demand when the ticketing flow first opens.
 *
 * Env: VITE_STRIPE_PUBLISHABLE_KEY — pk_test_... or pk_live_...
 */

const STRIPE_SRC = 'https://js.stripe.com/v3/'

export interface StripeLike {
  // Intentionally unknown shape — callers treat the returned object as opaque.
  confirmCardPayment?: (clientSecret: string, data?: unknown) => Promise<unknown>
  elements?: (opts?: unknown) => unknown
  redirectToCheckout?: (opts: { sessionId: string }) => Promise<unknown>
}

let stripePromise: Promise<StripeLike | null> | null = null

export function loadStripe(publishableKey?: string): Promise<StripeLike | null> {
  if (stripePromise) return stripePromise
  const key = publishableKey ?? import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key) {
    stripePromise = Promise.resolve(null)
    return stripePromise
  }

  stripePromise = new Promise(resolve => {
    if (typeof window === 'undefined') return resolve(null)
    type WindowWithStripe = typeof window & { Stripe?: (key: string) => StripeLike }
    const w = window as WindowWithStripe
    if (w.Stripe) return resolve(w.Stripe(key))

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_SRC}"]`)
    const onLoad = () => {
      if (w.Stripe) resolve(w.Stripe(key))
      else resolve(null)
    }
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', () => resolve(null), { once: true })
      return
    }

    const s = document.createElement('script')
    s.src = STRIPE_SRC
    s.async = true
    s.addEventListener('load', onLoad, { once: true })
    s.addEventListener('error', () => resolve(null), { once: true })
    document.head.appendChild(s)
  })

  return stripePromise
}
