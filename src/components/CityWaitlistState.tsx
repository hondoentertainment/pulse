import { useState } from 'react'
import { MapPinLine, EnvelopeSimple, CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics'

interface CityWaitlistStateProps {
  /** The market/city label the user is currently viewing, if known. */
  cityLabel?: string
  /** Whether the empty feed is because the market is geo-gated (not yet launched). */
  geoGated: boolean
  /** Switch to a different, launched market. */
  onBrowseOtherCities?: () => void
}

/**
 * Shown when a market has no venues to display. Distinguishes a genuinely
 * not-yet-launched city (waitlist CTA) from an empty/loading market so users
 * never see a blank feed without context.
 */
export function CityWaitlistState({ cityLabel, geoGated, onBrowseOtherCities }: CityWaitlistStateProps) {
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)

  const handleJoin = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email')
      return
    }
    trackEvent({ type: 'waitlist_join', timestamp: Date.now(), city: cityLabel ?? 'unknown' })
    setJoined(true)
    toast.success('You’re on the list', { description: 'We’ll let you know when Pulse goes live near you.' })
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <MapPinLine size={32} weight="fill" aria-hidden />
      </div>

      {geoGated ? (
        <>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">
              Pulse isn’t live{cityLabel ? ` in ${cityLabel}` : ' here'} yet
            </h2>
            <p className="text-sm text-muted-foreground">
              We’re rolling out city by city. Join the waitlist and you’ll be first to know when your nightlife goes live.
            </p>
          </div>

          {joined ? (
            <div className="flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-3 text-accent">
              <CheckCircle size={20} weight="fill" aria-hidden />
              <span className="text-sm font-medium">You’re on the waitlist</span>
            </div>
          ) : (
            <div className="w-full space-y-2">
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Email for launch waitlist"
                  className="h-12 pl-10"
                />
              </div>
              <Button onClick={handleJoin} className="h-12 w-full">
                Join the waitlist
              </Button>
            </div>
          )}

          {onBrowseOtherCities && (
            <button
              onClick={onBrowseOtherCities}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Explore a launched city instead
            </button>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">No venues here yet</h2>
            <p className="text-sm text-muted-foreground">
              Nothing is showing for{cityLabel ? ` ${cityLabel}` : ' this area'} right now. Try another city or check back soon.
            </p>
          </div>
          {onBrowseOtherCities && (
            <Button variant="outline" onClick={onBrowseOtherCities} className="h-12">
              Browse other cities
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export default CityWaitlistState
