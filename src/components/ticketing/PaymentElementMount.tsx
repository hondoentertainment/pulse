/**
 * PaymentElementMount — small presentational component that mounts a
 * Stripe PaymentElement into a DOM container.
 *
 * The component owns the lifecycle: it creates Elements, mounts the
 * PaymentElement on mount, exposes a `ready` flag once Stripe signals
 * the element is interactive, and cleans up on unmount.
 */

import { useEffect, useRef, useState } from 'react'
import { createElements, type CreateElementsResult } from '@/lib/stripe-client'
import type { StripePaymentElement } from '@/lib/stripe-loader'

export interface PaymentElementMountProps {
  clientSecret: string
  /** Called once the element instance exists and Elements are ready to confirm. */
  onReady?: (ctx: CreateElementsResult) => void
  /** Surface in-element validation errors inline. */
  onValidationChange?: (error: string | null) => void
  /** Fired if Stripe.js cannot be loaded (missing pk, blocked, offline). */
  onLoadError?: (message: string) => void
}

export function PaymentElementMount({
  clientSecret,
  onReady,
  onValidationChange,
  onLoadError,
}: PaymentElementMountProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const elementRef = useRef<StripePaymentElement | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let mountedEl: StripePaymentElement | null = null

    ;(async () => {
      const ctx = await createElements(clientSecret)
      if (cancelled) return
      if (!ctx) {
        const msg = 'Payments are temporarily unavailable. Please try again later.'
        setLoadError(msg)
        onLoadError?.(msg)
        return
      }
      if (!containerRef.current) return
      const pe = ctx.elements.create('payment', { layout: 'tabs' })
      pe.mount(containerRef.current)
      elementRef.current = pe
      mountedEl = pe
      pe.on('ready', () => {
        if (cancelled) return
        setReady(true)
        onReady?.(ctx)
      })
      pe.on('change', event => {
        if (cancelled) return
        onValidationChange?.(event.error?.message ?? null)
      })
    })()

    return () => {
      cancelled = true
      try {
        mountedEl?.unmount()
        mountedEl?.destroy()
      } catch {
        // ignore cleanup errors
      }
      elementRef.current = null
    }
    // Re-create elements only when the client secret changes. `onReady` /
    // `onValidationChange` are assumed stable from the caller; we deliberately
    // avoid re-mounting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret])

  return (
    <div data-testid="payment-element-mount" className="w-full">
      <div
        ref={containerRef}
        className="min-h-[180px] w-full rounded-xl border border-border bg-background p-3"
        aria-label="Payment details"
      />
      {!ready && !loadError && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Loading secure payment form…
        </p>
      )}
      {loadError && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {loadError}
        </p>
      )}
    </div>
  )
}
