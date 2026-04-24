import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Pulse, User, Venue } from '@/lib/types'
import { CaretLeft, Megaphone, Users, Disc, CurrencyDollar, ShieldCheck, Sparkle } from '@phosphor-icons/react'
import { buildOwnerDashboard, createAnnouncement, type VenueAnnouncement } from '@/lib/venue-owner'
import { VenueOwnerDashboard as VenueOwnerDashboardCard } from '@/components/VenueOwnerDashboard'
import {
  formatGuestListStatus,
  getVenueOperatorStatus,
  seedVenueOperatorStatus,
  updateVenueOperatorStatus,
} from '@/lib/venue-operator-live'

interface OwnerDashboardPageProps {
  currentUser: User
  venues: Venue[]
  pulses: Pulse[]
  onBack: () => void
}

export function OwnerDashboardPage({
  currentUser,
  venues,
  pulses,
  onBack,
}: OwnerDashboardPageProps) {
  const managedVenues = useMemo(() => {
    const favorites = new Set(currentUser.favoriteVenues ?? [])
    const followed = new Set(currentUser.followedVenues ?? [])
    const preferred = venues.filter(venue => favorites.has(venue.id) || followed.has(venue.id))
    return preferred.length > 0 ? preferred : venues.slice(0, 5)
  }, [currentUser.favoriteVenues, currentUser.followedVenues, venues])

  const [selectedVenueId, setSelectedVenueId] = useState<string>(managedVenues[0]?.id ?? venues[0]?.id ?? '')
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([])

  useEffect(() => {
    if (!selectedVenueId) return
    const venue = venues.find(item => item.id === selectedVenueId)
    if (!venue) return
    seedVenueOperatorStatus(venue.id, venue.name)
  }, [selectedVenueId, venues])

  const selectedVenue = venues.find(venue => venue.id === selectedVenueId) ?? managedVenues[0]
  const operatorStatus = selectedVenue ? getVenueOperatorStatus(selectedVenue.id) : null
  const dashboard = selectedVenue ? buildOwnerDashboard(selectedVenue, pulses) : null
  const activeAnnouncements = announcements.filter(announcement => announcement.venueId === selectedVenue?.id)

  const publishUpdate = (updates: Parameters<typeof updateVenueOperatorStatus>[2], announcementTitle: string, announcementBody: string) => {
    if (!selectedVenue) return
    updateVenueOperatorStatus(selectedVenue.id, currentUser.id, updates)
    setAnnouncements(current => [
      createAnnouncement(selectedVenue.id, currentUser.id, announcementTitle, announcementBody, 'special', undefined, 4),
      ...current,
    ])
  }

  if (!selectedVenue || !dashboard) {
    return null
  }
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="rounded-lg p-2 hover:bg-muted">
            <CaretLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Venue Operator</h1>
            <p className="text-xs text-muted-foreground">Push live updates that shape guest decisions in real time.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Managed Venue
          </label>
          <select
            value={selectedVenueId}
            onChange={(event) => setSelectedVenueId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {managedVenues.map(venue => (
              <option key={venue.id} value={venue.id}>{venue.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <QuickActionCard
            icon={<ShieldCheck size={18} weight="fill" className="text-primary" />}
            title="Guest List"
            subtitle={formatGuestListStatus(operatorStatus?.guestListStatus ?? null) ?? 'Not published yet'}
            actions={[
              { label: 'Open', onClick: () => publishUpdate({ guestListStatus: 'open' }, 'Guest list open', 'Walk-ins and list guests are both getting in smoothly.') },
              { label: 'Limited', onClick: () => publishUpdate({ guestListStatus: 'limited' }, 'Guest list limited', 'Guest list is still moving, but capacity is tightening up.') },
              { label: 'Closed', onClick: () => publishUpdate({ guestListStatus: 'closed' }, 'Guest list closed', 'Guest list is closed for the night. Tables and walk-ins only.') },
            ]}
          />
          <QuickActionCard
            icon={<CurrencyDollar size={18} weight="fill" className="text-green-400" />}
            title="Table Minimum"
            subtitle={operatorStatus?.tableMinimum ? `$${operatorStatus.tableMinimum}` : 'No minimum posted'}
            actions={[
              { label: 'None', onClick: () => publishUpdate({ tableMinimum: null }, 'Tables open', 'No table minimum is being enforced right now.') },
              { label: '$300', onClick: () => publishUpdate({ tableMinimum: 300 }, 'Tables from $300', 'Tables are currently starting around $300.') },
              { label: '$500', onClick: () => publishUpdate({ tableMinimum: 500 }, 'Tables from $500', 'Premium table packages are starting around $500.') },
            ]}
          />
          <QuickActionCard
            icon={<Disc size={18} weight="fill" className="text-purple-400" />}
            title="Music Update"
            subtitle={operatorStatus?.djStatus ?? 'No programming update yet'}
            actions={[
              { label: 'DJ on now', onClick: () => publishUpdate({ djStatus: 'DJ on now' }, 'DJ on now', 'The DJ is live and the room is ramping up.') },
              { label: 'Headliner soon', onClick: () => publishUpdate({ djStatus: 'Headliner in 30 min' }, 'Headliner soon', 'Headliner hits in about 30 minutes.') },
              { label: 'Open format', onClick: () => publishUpdate({ djStatus: 'Open format till midnight' }, 'Open format set', 'Open format set rolling till midnight.') },
            ]}
          />
          <QuickActionCard
            icon={<Sparkle size={18} weight="fill" className="text-amber-400" />}
            title="Special Update"
            subtitle={operatorStatus?.special ?? 'No special published'}
            actions={[
              { label: 'Free before 11', onClick: () => publishUpdate({ special: 'Free before 11 PM', doorNote: 'Best odds before 11:00 PM' }, 'Free before 11', 'Guests can still get in free before 11 PM.') },
              { label: 'Kitchen late', onClick: () => publishUpdate({ special: 'Kitchen serving late menu' }, 'Late menu live', 'The kitchen is serving the late-night menu.') },
              { label: 'Fast line', onClick: () => publishUpdate({ doorNote: 'Walk-ins still getting in' }, 'Door moving fast', 'The line is moving faster than usual right now.') },
            ]}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone size={18} weight="fill" className="text-accent" />
            <h2 className="font-bold">Live message preview</h2>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {operatorStatus?.special && <p>{operatorStatus.special}</p>}
            {operatorStatus?.djStatus && <p>{operatorStatus.djStatus}</p>}
            {operatorStatus?.doorNote && <p>{operatorStatus.doorNote}</p>}
            {!operatorStatus?.special && !operatorStatus?.djStatus && !operatorStatus?.doorNote && (
              <p>No customer-facing update published yet.</p>
            )}
          </div>
        </div>

        <VenueOwnerDashboardCard
          dashboard={dashboard}
          announcements={activeAnnouncements}
          onCreateAnnouncement={() => publishUpdate({ special: 'New owner announcement live' }, 'Owner update', 'Fresh update published for guests browsing tonight.')}
        />

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users size={18} weight="fill" className="text-blue-400" />
            <h2 className="font-bold">Recent operator posts</h2>
          </div>
          <div className="space-y-2">
            {activeAnnouncements.slice(0, 5).map(announcement => (
              <div key={announcement.id} className="rounded-lg bg-background px-3 py-2">
                <p className="text-sm font-medium">{announcement.title}</p>
                <p className="text-xs text-muted-foreground">{announcement.body}</p>
              </div>
            ))}
            {activeAnnouncements.length === 0 && (
              <p className="text-sm text-muted-foreground">No operator posts yet for this venue.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  actions: { label: string; onClick: () => void }[]
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map(action => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary/40 hover:text-primary"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
