/**
 * PayoutOnboarding — minimal Stripe Connect onboarding stub.
 *
 * The real flow creates a Stripe Connect account for the venue, returns
 * an onboarding URL, and polls `/accounts/:id` until `charges_enabled`.
 * This stub exposes the UI surface so CreatorDashboard can embed it;
 * the network calls will light up once the `/api/ticketing/connect`
 * endpoints land (tracked in follow-ups).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { isFeatureEnabled } from '@/lib/feature-flags'

export interface PayoutOnboardingProps {
  venueId: string | null
}

export function PayoutOnboarding({ venueId }: PayoutOnboardingProps) {
  const ticketingOn = isFeatureEnabled('ticketing')
  const [status, setStatus] = useState<'idle' | 'starting' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!ticketingOn) {
    return (
      <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Ticketing payouts are disabled. Enable the <code>ticketing</code> flag to
        configure Stripe Connect.
      </div>
    )
  }

  if (!venueId) {
    return (
      <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Select a venue to manage payouts.
      </div>
    )
  }

  async function handleStart() {
    if (!venueId) return
    setStatus('starting')
    setError(null)
    try {
      const res = await fetch('/api/ticketing/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ venueId }),
      })
      if (!res.ok) {
        setStatus('error')
        setError(`HTTP ${res.status}`)
        return
      }
      const payload = (await res.json()) as { url?: string }
      if (payload.url) {
        window.location.assign(payload.url)
        return
      }
      setStatus('error')
      setError('No onboarding URL returned.')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Network error')
    }
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div>
        <h3 className="font-bold">Payouts</h3>
        <p className="text-sm text-muted-foreground">
          Connect a Stripe account to receive event revenue. Onboarding takes
          about 3 minutes.
        </p>
      </div>
      <Button onClick={handleStart} disabled={status === 'starting'}>
        {status === 'starting' ? 'Starting…' : 'Connect Stripe'}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
