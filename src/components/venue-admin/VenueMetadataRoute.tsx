/**
 * VenueMetadataRoute — admin-only route for editing a venue's structured
 * metadata. Non-admins get a clear 403 state.
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAppState } from '@/hooks/use-app-state'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { VenueMetadataForm } from '@/components/venue-admin/VenueMetadataForm'

export function VenueMetadataRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, isLoading, isPlaceholder } = useSupabaseAuth()
  const { venues } = useAppState()

  const role =
    (session?.user?.app_metadata as Record<string, unknown> | undefined)?.role ?? null
  // In the prototype-auth (placeholder Supabase) mode we have no real session.
  // Only the real Supabase path can carry an admin role, so placeholder mode
  // intentionally renders the 403 state — flip credentials on to access the UI.
  const isAdmin = !isPlaceholder && role === 'admin'

  const venue = useMemo(
    () => (venues && id ? venues.find((v) => v.id === id) ?? null : null),
    [venues, id],
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 space-y-3 border-border" role="alert">
          <h1 className="text-lg font-bold">403 — Admin access required</h1>
          <p className="text-sm text-muted-foreground">
            You need an admin role to edit venue metadata. If you believe this
            is a mistake, ask an administrator to update your account.
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Go home
          </Button>
        </Card>
      </div>
    )
  }

  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 space-y-3 border-border">
          <h1 className="text-lg font-bold">Venue not specified</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            Go home
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Venue admin</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
        <VenueMetadataForm
          venueId={id}
          venueName={venue?.name}
          initial={
            venue
              ? {
                  dressCode: venue.dressCode ?? null,
                  coverChargeCents: venue.coverChargeCents ?? null,
                  coverChargeNote: venue.coverChargeNote ?? null,
                  accessibilityFeatures: venue.accessibilityFeatures ?? null,
                  indoorOutdoor: venue.indoorOutdoor ?? null,
                  capacityHint: venue.capacityHint ?? null,
                }
              : undefined
          }
        />
      </div>
    </main>
  )
}

export default VenueMetadataRoute
