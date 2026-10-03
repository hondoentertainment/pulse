import { useState } from 'react'
import { toast } from 'sonner'
import { isVenueSurgeMuted, writeVenueSurgeMuted } from '@/lib/surge-prefs'
import { saveVenueSurgeMuted } from '@/lib/data/surge-prefs'

export function VenueSurgeMuteButton({ venueId }: { venueId: string }) {
  const [muted, setMuted] = useState(() => isVenueSurgeMuted(venueId))

  return (
    <button
      type="button"
      className="min-h-11 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
      onClick={() => {
        const next = !muted
        writeVenueSurgeMuted(venueId, next)
        setMuted(next)
        void saveVenueSurgeMuted(venueId, next).then((ok) => {
          if (!ok) {
            toast.message(next ? 'Muted on this device' : 'Unmuted on this device', {
              description: 'Server mute applies after you follow this venue and surge columns are applied.',
            })
          }
        })
      }}
    >
      {muted ? 'Unmute surge' : 'Mute surge'}
    </button>
  )
}
