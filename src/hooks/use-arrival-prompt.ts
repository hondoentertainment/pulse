import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Venue } from '@/lib/types'
import {
  clearPendingArrival,
  getDueArrivalPrompt,
  pruneExpiredArrivals,
  type PendingArrival,
} from '@/lib/arrival-prompt'
import { trackArrivalConfirmed, trackMismatchReported } from '@/lib/decision-analytics'

export function useArrivalPrompt(venues: Venue[]) {
  const [pending, setPending] = useState<PendingArrival | null>(null)

  const refresh = useCallback(() => {
    pruneExpiredArrivals()
    setPending(getDueArrivalPrompt())
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const venue = pending ? venues.find((v) => v.id === pending.venueId) : undefined

  const confirmArrival = useCallback(() => {
    if (!pending) return
    trackArrivalConfirmed(pending.venueId)
    clearPendingArrival(pending.venueId)
    setPending(null)
    toast.success('Tip confirmed', {
      description: `${pending.venueName} stays accurate for the next crowd. Thanks.`,
    })
  }, [pending])

  const reportMismatch = useCallback(() => {
    if (!pending) return
    trackMismatchReported(pending.venueId, pending.displayedEnergy)
    clearPendingArrival(pending.venueId)
    setPending(null)
    toast.success("You fixed tonight's tip", {
      description: `${pending.venueName} now shows honest energy because you spoke up.`,
    })
  }, [pending])

  const dismiss = useCallback(() => {
    if (!pending) return
    clearPendingArrival(pending.venueId)
    setPending(null)
  }, [pending])

  return {
    pending,
    venue,
    confirmArrival,
    reportMismatch,
    dismiss,
  }
}
