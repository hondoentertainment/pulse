/**
 * Typed wrapper around Stripe.js for the PaymentElement flow.
 *
 * All functions are strongly typed — no `any`. The wrapper exists so the
 * rest of the app talks to a stable surface and we can swap the
 * implementation (e.g. mock in tests) without spreading Stripe types
 * through the UI layer.
 */

import {
  loadStripe,
  type StripeElements,
  type StripeInstance,
  type StripePaymentElement,
} from './stripe-loader'

export interface CreateElementsResult {
  stripe: StripeInstance
  elements: StripeElements
}

export interface ConfirmPaymentResult {
  paymentIntent?: { id: string; status: string }
  error?: { message?: string; code?: string; type?: string }
}

/**
 * Initialize Stripe + an Elements set for a given PaymentIntent client_secret.
 * Returns null when Stripe.js cannot be loaded (missing publishable key or
 * offline) so the caller can render a fallback.
 */
export async function createElements(clientSecret: string): Promise<CreateElementsResult | null> {
  if (!clientSecret) return null
  const stripe = await loadStripe()
  if (!stripe) return null
  const elements = stripe.elements({
    clientSecret,
    appearance: { theme: 'night' },
  })
  return { stripe, elements }
}

/**
 * Mount the PaymentElement into a container. Returns the element instance so
 * the caller can destroy/unmount it on cleanup.
 */
export function mountPaymentElement(
  elements: StripeElements,
  container: HTMLElement
): StripePaymentElement {
  const paymentElement = elements.create('payment', { layout: 'tabs' })
  paymentElement.mount(container)
  return paymentElement
}

export interface ConfirmPaymentParams {
  stripe: StripeInstance
  elements: StripeElements
  returnUrl?: string
  /** When true (default), Stripe will not redirect unless required (e.g. 3DS). */
  redirectIfRequired?: boolean
}

/**
 * Confirm a PaymentIntent using the currently mounted PaymentElement. We
 * prefer `redirect: 'if_required'` so the SPA stays in control for most
 * card flows; 3DS and other redirect-based methods will still navigate
 * away but return to `returnUrl`.
 */
export async function confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
  const { stripe, elements, returnUrl, redirectIfRequired = true } = params
  const result = await stripe.confirmPayment({
    elements,
    confirmParams: returnUrl ? { return_url: returnUrl } : {},
    redirect: redirectIfRequired ? 'if_required' : 'always',
  })
  return {
    paymentIntent: result.paymentIntent,
    error: result.error,
  }
}
