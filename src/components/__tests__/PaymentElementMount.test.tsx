import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PaymentElementMount } from '@/components/ticketing/PaymentElementMount'

// Mock the stripe client so we don't hit the real Stripe.js loader.
vi.mock('@/lib/stripe-client', () => {
  return {
    createElements: vi.fn(async () => null),
  }
})

describe('PaymentElementMount', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders a container div', () => {
    const { getByTestId } = render(<PaymentElementMount clientSecret="cs_test_123" />)
    const el = getByTestId('payment-element-mount')
    expect(el).toBeTruthy()
    expect(el.tagName).toBe('DIV')
  })

  it('shows a graceful error when Stripe fails to load', async () => {
    const onLoadError = vi.fn()
    const { findByRole } = render(
      <PaymentElementMount clientSecret="cs_test_123" onLoadError={onLoadError} />
    )
    // loadError path is surfaced via role="alert"
    const alert = await findByRole('alert')
    expect(alert.textContent).toMatch(/temporarily unavailable/i)
    expect(onLoadError).toHaveBeenCalled()
  })

  it('cleans up on unmount without throwing', () => {
    const { unmount } = render(<PaymentElementMount clientSecret="cs_test_123" />)
    expect(() => unmount()).not.toThrow()
  })
})
