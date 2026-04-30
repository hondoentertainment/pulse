/**
 * PayoutOnboarding
 *
 * Three-step UI that triggers Stripe Connect onboarding for a venue:
 *   1. Explain — what Stripe Connect is, what the venue will need.
 *   2. Launch — call /api/venue-payouts/onboarding and open the Stripe link.
 *   3. Return — show current account status (active / pending / restricted).
 *
 * This component is intentionally self-contained so it can be dropped into
 * the existing `CreatorDashboard` (or a future venue admin area) without
 * restructuring. Default-off: only renders when `featureFlags.ticketing`
 * is enabled.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requestPayoutOnboarding } from '@/lib/ticketing-client'
import { featureFlags } from '@/lib/feature-flags'

interface PayoutOnboardingProps {
  venueId: string
  /** Current account status from `venue_payout_accounts`, if any. */
  initialStatus?: 'pending' | 'active' | 'restricted' | null
}

export function PayoutOnboarding({ venueId, initialStatus }: PayoutOnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStatus === 'active' ? 3 : 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'pending' | 'active' | 'restricted' | null>(
    initialStatus ?? null,
  )

  if (!featureFlags.ticketing) return null

  const launch = async () => {
    setLoading(true)
    setError(null)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const result = await requestPayoutOnboarding({
        venue_id: venueId,
        refresh_url: `${origin}/venue-admin/payouts?refresh=1`,
        return_url: `${origin}/venue-admin/payouts?return=1`,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStatus('pending')
      setStep(3)
      if (typeof window !== 'undefined') {
        window.location.href = result.data.onboarding_url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5 space-y-4 border-border">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Payout onboarding</h3>
        <span className="text-xs text-muted-foreground">Step {step} of 3</span>
      </div>

      {step === 1 && (
        <div className="space-y-3 text-sm">
          <p>
            To accept ticket payments directly, this venue needs a Stripe Connect
            Express account. Stripe handles KYC, bank linking, and payouts on our
            behalf.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Legal entity name and EIN (or SSN for sole proprietors)</li>
            <li>Business address and bank account for deposits</li>
            <li>One owner or authorised representative to complete KYC</li>
          </ul>
          <Button onClick={() => setStep(2)}>Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 text-sm">
          <p>
            Clicking below will open Stripe's hosted onboarding in a new tab.
            You can return at any time — progress is saved.
          </p>
          {error && (
            <div role="alert" className="rounded-md bg-red-500/10 border border-red-500/30 p-2 text-red-400 text-xs">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={launch} disabled={loading}>
              {loading ? 'Preparing…' : 'Launch Stripe onboarding'}
            </Button>
            <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2 text-sm">
          <p>
            Status:{' '}
            <span className="font-semibold">
              {status === 'active' ? 'Active' : status === 'restricted' ? 'Restricted' : 'Pending'}
            </span>
          </p>
          {status === 'pending' && (
            <p className="text-muted-foreground text-xs">
              Stripe may still need additional documents. We'll update this page
              automatically once they approve the account.
            </p>
          )}
          {status === 'restricted' && (
            <p className="text-red-400 text-xs">
              Stripe has flagged this account. Re-run onboarding to resolve
              outstanding requirements.
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => setStep(2)}>
            Update details
          </Button>
        </div>
      )}
    </Card>
  )
}
