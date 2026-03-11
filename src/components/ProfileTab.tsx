import { Venue, Pulse, PulseWithUser, User } from '@/lib/types'
import { PulseCard } from '@/components/PulseCard'
import { PulseScore } from '@/components/PulseScore'
import { Settings } from '@/components/Settings'
import { Separator } from '@/components/ui/separator'
import { Star, MapPin, Gear, Storefront } from '@phosphor-icons/react'

interface ProfileTabProps {
  currentUser: User
  pulses: Pulse[]
  pulsesWithUsers: PulseWithUser[]
  favoriteVenues: Venue[]
  onVenueClick: (venue: Venue) => void
  onReaction: (pulseId: string, type: 'fire' | 'eyes' | 'skull' | 'lightning') => void
  onOpenSocialPulseDashboard: () => void
  onOpenSettings?: () => void
  onOpenOwnerDashboard?: () => void
}

export function ProfileTab({
  currentUser,
  pulses,
  pulsesWithUsers,
  favoriteVenues,
  onVenueClick,
  onReaction,
  onOpenSocialPulseDashboard,
  onOpenSettings,
  onOpenOwnerDashboard,
}: ProfileTabProps) {
  const userPulses = pulsesWithUsers.filter((p) => p.userId === currentUser.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent p-1">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
            <span className="text-2xl font-bold">{currentUser.username.slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{currentUser.username}</h2>
          <p className="text-sm text-muted-foreground">
            {pulses.filter((p) => p.userId === currentUser.id).length} pulses
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Member since {new Date(currentUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <Separator />

      {favoriteVenues.length > 0 && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star size={20} weight="fill" className="text-accent" />
              <h3 className="text-lg font-bold">Favorite Venues</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {favoriteVenues.map((venue) => {
                const venuePulses = pulses.filter((p) => p.venueId === venue.id)
                const latestPulse = venuePulses.sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )[0]

                return (
                  <button
                    key={venue.id}
                    onClick={() => onVenueClick(venue)}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent transition-all group"
                  >
                    {latestPulse?.photos?.[0] ? (
                      <img
                        src={latestPulse.photos[0]}
                        alt={venue.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
                        <MapPin size={24} weight="fill" className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                      <p className="text-xs font-bold text-white truncate">{venue.name}</p>
                    </div>
                    <div className="absolute top-1 right-1">
                      <PulseScore score={venue.pulseScore} size="xs" showLabel={false} />
                    </div>
                  </button>
                )
              })}
              {Array.from({ length: Math.max(0, 4 - favoriteVenues.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center"
                >
                  <Star size={20} className="text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>

          <Separator />
        </>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Your Pulses</h3>
        {userPulses.map((pulse) => (
          <PulseCard
            key={pulse.id}
            pulse={pulse}
            allPulses={pulsesWithUsers}
            onReaction={(type) => onReaction(pulse.id, type)}
          />
        ))}
        {userPulses.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No pulses yet. Check into a venue to get started!
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gear size={20} weight="fill" className="text-primary" />
          <h3 className="text-lg font-bold">Settings</h3>
        </div>
        {onOpenOwnerDashboard && (
          <button onClick={onOpenOwnerDashboard} className="flex items-center gap-2 p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors w-full">
            <Storefront size={18} weight="fill" className="text-primary" />
            <span className="text-sm font-medium">Venue Owner Dashboard</span>
          </button>
        )}
        {onOpenSettings ? (
          <button
            onClick={onOpenSettings}
            className="w-full p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors text-left flex items-center gap-3"
          >
            <Gear size={20} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">App Settings</p>
              <p className="text-xs text-muted-foreground">Notifications, privacy, display</p>
            </div>
          </button>
        ) : (
          <Settings
            onOpenSocialPulseDashboard={onOpenSocialPulseDashboard}
          />
        )}
      </div>
    </div>
  )
}
