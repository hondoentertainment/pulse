import { useState } from 'react'
import { Venue, Pulse, PulseWithUser, User } from '@/lib/types'
import { PulseCard } from '@/components/PulseCard'
import { PulseScore } from '@/components/PulseScore'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Star, MapPin, Gear, Storefront, UserPlus, Link, Check, Lightning, ShieldCheck } from '@phosphor-icons/react'
import { createFriendInviteLink } from '@/lib/social-graph'
import { createReferralInvite } from '@/lib/sharing'
import { getCreatorTierProgress } from '@/lib/creator-economy'
import { CreatorProfileBadge } from '@/components/CreatorProfileBadge'
import { toast } from 'sonner'

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
  onOpenCreatorDashboard?: () => void
  onOpenModerationQueue?: () => void
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
  onOpenCreatorDashboard,
  onOpenModerationQueue,
}: ProfileTabProps) {
  const userPulses = pulsesWithUsers.filter((p) => p.userId === currentUser.id)
  const [inviteCopied, setInviteCopied] = useState(false)

  const totalReactions = pulses
    .filter(p => p.userId === currentUser.id)
    .reduce((sum, p) =>
      sum + p.reactions.fire.length + p.reactions.eyes.length +
      p.reactions.skull.length + p.reactions.lightning.length, 0)
  const tierProgress = getCreatorTierProgress(
    pulses.filter(p => p.userId === currentUser.id).length,
    totalReactions,
    currentUser.friends.length
  )

  const handleInviteFriends = async () => {
    const invite = createReferralInvite(currentUser.id)
    const link = createFriendInviteLink(currentUser.id)
    const text = `Join me on Pulse! Use code ${invite.inviteCode}: ${link.url}`
    try {
      await navigator.clipboard.writeText(text)
      setInviteCopied(true)
      toast.success('Invite link copied!')
      setTimeout(() => setInviteCopied(false), 2000)
    } catch {
      toast.error('Failed to copy invite link')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] p-1">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
            <span className="text-2xl font-bold">{currentUser.username.slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">{currentUser.username}</h2>
            {currentUser.postStreak && currentUser.postStreak >= 2 && (
              <Badge className="bg-[#F77737]/20 text-[#F77737] hover:bg-[#F77737]/30 border-[#F77737]/30 text-xs py-0 h-5">
                🔥 {currentUser.postStreak} Day Streak
              </Badge>
            )}
            {tierProgress.currentTier && (
              <CreatorProfileBadge tier={tierProgress.currentTier} size="sm" />
            )}
          </div>
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
              <Star size={20} weight="fill" className="text-[#FCAF45]" />
              <h3 className="text-lg font-semibold">Favorite Venues</h3>
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
                    className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 hover:border-[#E1306C]/40 transition-all group shadow-lg"
                  >
                    {latestPulse?.photos?.[0] ? (
                      <img
                        src={latestPulse.photos[0]}
                        alt={venue.name}
                        loading="lazy"
                        decoding="async"
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
                  className="aspect-square rounded-2xl border border-dashed border-white/10 bg-muted/30 flex items-center justify-center"
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
        <h3 className="text-lg font-semibold">Your Pulses</h3>
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
          <UserPlus size={20} weight="fill" className="text-[#E1306C]" />
          <h3 className="text-lg font-semibold">Invite Friends</h3>
        </div>
        <button
          onClick={handleInviteFriends}
          className="w-full p-4 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-[#E1306C]/30 transition-colors text-left flex items-center gap-3 shadow-lg"
        >
          {inviteCopied ? (
            <Check size={20} weight="bold" className="text-[#E1306C]" />
          ) : (
            <Link size={20} className="text-[#E1306C]" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{inviteCopied ? 'Link Copied!' : 'Copy Invite Link'}</p>
            <p className="text-xs text-muted-foreground">Share with friends to join Pulse</p>
          </div>
        </button>
      </div>

      <Separator />

      {onOpenCreatorDashboard && (
        <div className="space-y-3">
          <button
            onClick={onOpenCreatorDashboard}
            className="w-full bg-gradient-to-r from-[#833AB4]/10 to-[#FCAF45]/10 rounded-2xl p-4 border border-white/10 flex items-center gap-3 hover:border-[#833AB4]/40 transition-colors backdrop-blur-xl"
          >
            <Lightning size={24} weight="fill" className="text-[#833AB4]" />
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">Creator Dashboard</p>
              <p className="text-xs text-muted-foreground">
                {tierProgress.currentTier
                  ? `${tierProgress.currentTier.charAt(0).toUpperCase() + tierProgress.currentTier.slice(1)} Creator — View analytics & earnings`
                  : `${tierProgress.progress}% to Rising Creator`}
              </p>
            </div>
          </button>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gear size={20} weight="fill" className="text-[#833AB4]" />
          <h3 className="text-lg font-semibold">Settings</h3>
        </div>
        {onOpenOwnerDashboard && (
          <button onClick={onOpenOwnerDashboard} className="flex items-center gap-2 p-3 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-[#833AB4]/30 transition-colors w-full">
            <Storefront size={18} weight="fill" className="text-[#833AB4]" />
            <span className="text-sm font-medium">Venue Owner Dashboard</span>
          </button>
        )}
        {onOpenModerationQueue && (
          <button onClick={onOpenModerationQueue} className="flex items-center gap-2 p-3 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-[#833AB4]/30 transition-colors w-full">
            <ShieldCheck size={18} weight="fill" className="text-[#833AB4]" />
            <span className="text-sm font-medium">Moderation Queue</span>
          </button>
        )}
        {onOpenSettings ? (
          <button
            onClick={onOpenSettings}
            className="w-full p-4 bg-card/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-[#833AB4]/30 transition-colors text-left flex items-center gap-3 shadow-lg"
          >
            <Gear size={20} className="text-[#833AB4]" />
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
