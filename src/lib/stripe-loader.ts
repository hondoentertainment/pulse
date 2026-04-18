/**
 * Stripe.js loader.
 *
 * Loads the Stripe.js script from Stripe's CDN on demand and resolves to a
 * typed `Stripe` instance. Keeps Stripe fully out of the main bundle until a
 * user actively hits a payments flow.
 *
 * No runtime dependency on `@stripe/stripe-js` — we only use its types (if
 * present at build time they will be tree-shaken; if not, the `unknown`
 * fallback keeps the callsite safe).
 */

/** Minimal structural Stripe type. Real Stripe.js matches this shape. */
export interface StripeInstance {
  elements: (options: { clientSecret: string; appearance?: Record<string, unknown> }) => StripeElements
  confirmPayment: (args: {
    elements: StripeElements
    confirmParams: { return_url?: string; [key: string]: unknown }
    redirect?: 'if_required' | 'always'
  }) => Promise<{
    paymentIntent?: { id: string; status: string }
    error?: { message?: string; type?: string; code?: string }
  }>
  retrievePaymentIntent: (clientSecret: string) => Promise<{
    paymentIntent?: { id: string; status: string }
    error?: { message?: string }
  }>
}

export interface StripeElements {
  create: (type: 'payment', options?: Record<string, unknown>) => StripePaymentElement
  getElement: (type: 'payment') => StripePaymentElement | null
  submit: () => Promise<{ error?: { message?: string } }>
}

export interface StripePaymentElement {
  mount: (selector: string | HTMLElement) => void
  unmount: () => void
  on: (event: string, handler: (event: { complete?: boolean; error?: { message?: string } }) => void) => void
  destroy: () => void
}

interface StripeGlobal {
  (publishableKey: string, options?: Record<string, unknown>): StripeInstance
}

declare global {
  interface Window {
    Stripe?: StripeGlobal
  }
}

const STRIPE_SRC = 'https://js.stripe.com/v3/'

let cachedLoader: Promise<StripeInstance | null> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No document available'))
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')))
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')))
    document.head.appendChild(script)
  })
}

/**
 * Load Stripe.js and return an initialized Stripe instance.
 * Returns null when no publishable key is configured (e.g. dev without
 * Stripe keys) so callers can render a graceful fallback.
 */
export function loadStripe(publishableKey?: string | null): Promise<StripeInstance | null> {
  if (cachedLoader) return cachedLoader
  const key = publishableKey ?? (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)
  if (!key) {
    return Promise.resolve(null)
  }
  cachedLoader = (async () => {
    try {
      if (typeof window === 'undefined') return null
      if (!window.Stripe) {
        await loadScript(STRIPE_SRC)
      }
      if (!window.Stripe) return null
      return window.Stripe(key)
    } catch {
      return null
    }
  })()
  return cachedLoader
}

/** Exposed for tests: reset the memoized loader. */
export function __resetStripeLoaderForTests(): void {
  cachedLoader = null
}
