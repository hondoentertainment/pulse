import { useState } from 'react'
import { toast } from 'sonner'
import { Shield, CarProfile } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { logTrustedRide } from '@/lib/data/safety'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'

export interface TrustedRideCtaProps {
  userId: string
  provider: 'uber' | 'lyft'
  pickup?: { lat: number; lng: number }
  dropoff?: { lat: number; lng: number }
  sessionId?: string
  className?: string
}

/**
 * Optional call-to-action that logs a rideshare trip to `trusted_rides` so a
 * contact can follow along. Renders null when the safety kit flag is off.
 */
export function TrustedRideCta(props: TrustedRideCtaProps) {
  const [busy, setBusy] = useState(false)

  if (!isFeatureEnabled('safetyKit')) return null

  const onClick = async () => {
    setBusy(true)
    const result = await logTrustedRide({
      userId: props.userId,
      provider: props.provider,
      pickup: props.pickup,
      dropoff: props.dropoff,
      sessionId: props.sessionId,
    })
    setBusy(false)
    if (result.ok) {
      toast.success('Trip logged for your trusted contacts.')
    } else {
      toast.error(result.error ?? 'Could not log ride')
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      className={cn('h-10', props.className)}
      data-testid="trusted-ride-cta"
    >
      <Shield size={14} weight="fill" />
      <CarProfile size={14} weight="fill" />
      {busy ? 'Logging…' : `Trusted ${props.provider === 'uber' ? 'Uber' : 'Lyft'}`}
    </Button>
  )
}
