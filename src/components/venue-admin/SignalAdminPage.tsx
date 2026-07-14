/**
 * SignalAdminPage — admin dashboard for signal suppression and scout approvals.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { SCOUT_TIERS, type ScoutTier } from '@/lib/scout-program'
import { setVenueSignalSuppression } from '@/lib/venue-admin-client'

interface ScoutApplicationRow {
  id: string
  user_id: string
  status: string
  tier: ScoutTier
  motivation?: string | null
  neighborhoods?: string[]
  created_at: string
  profiles?: { username?: string; display_name?: string } | null
}

interface VenuesCompletenessRow {
  id: string
  name: string
  city: string | null
}

export function SignalAdminPage() {
  const navigate = useNavigate()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()
  const [venues, setVenues] = useState<VenuesCompletenessRow[]>([])
  const [applications, setApplications] = useState<ScoutApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suppressReason, setSuppressReason] = useState<Record<string, string>>({})
  const [busyVenueId, setBusyVenueId] = useState<string | null>(null)
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null)

  const role =
    (session?.user?.app_metadata as Record<string, unknown> | undefined)?.role ?? null
  const isAdmin = !isPlaceholder && role === 'admin'

  const loadData = async (token: string) => {
    const [venuesRes, appsRes] = await Promise.all([
      fetch('/api/admin/venues-completeness?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/admin/scout-applications', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    if (!venuesRes.ok) throw new Error(`Venues load failed: ${venuesRes.status}`)
    if (!appsRes.ok) throw new Error(`Scout applications load failed: ${appsRes.status}`)

    const venuesJson = (await venuesRes.json()) as { data: { venues: VenuesCompletenessRow[] } }
    const appsJson = (await appsRes.json()) as { data: { applications: ScoutApplicationRow[] } }
    setVenues(venuesJson.data?.venues ?? [])
    setApplications(appsJson.data?.applications ?? [])
  }

  useEffect(() => {
    if (authLoading || !isAdmin) {
      setLoading(false)
      return
    }

    const token = session?.access_token
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    loadData(token)
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load admin data')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isAdmin, session?.access_token])

  const handleSuppressToggle = async (venueId: string, suppressed: boolean) => {
    setBusyVenueId(venueId)
    try {
      await setVenueSignalSuppression(venueId, suppressed, suppressReason[venueId])
      toast.success(suppressed ? 'Signal suppressed' : 'Signal restored')
      if (session?.access_token) await loadData(session.access_token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyVenueId(null)
    }
  }

  const handleReview = async (
    applicationId: string,
    action: 'approve' | 'reject',
    tier: ScoutTier = 'rookie',
  ) => {
    const token = session?.access_token
    if (!token) return
    setBusyApplicationId(applicationId)
    try {
      const res = await fetch('/api/admin/scout-applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          application_id: applicationId,
          action,
          tier: action === 'approve' ? tier : undefined,
        }),
      })
      if (!res.ok) throw new Error(`Review failed: ${res.status}`)
      toast.success(action === 'approve' ? 'Scout approved' : 'Application rejected')
      await loadData(token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Review failed')
    } finally {
      setBusyApplicationId(null)
    }
  }

  if (authLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center space-y-3">
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="text-sm text-muted-foreground">
          Signal suppression and scout approvals are limited to admin accounts.
        </p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Tonight
        </Button>
      </div>
    )
  }

  const pendingApplications = applications.filter((app) => app.status === 'pending')

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Signal & Scout admin</h1>
          <p className="text-sm text-muted-foreground">
            Suppress bad signal and approve scout applications.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/venues/completeness')}>
          Data quality
        </Button>
      </div>

      {error && (
        <Card className="p-3 border-destructive/40 text-sm text-destructive">{error}</Card>
      )}

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Scout applications</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications…</p>
        ) : pendingApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending applications.</p>
        ) : (
          <ul className="space-y-3">
            {pendingApplications.map((app) => {
              const name =
                app.profiles?.display_name ?? app.profiles?.username ?? app.user_id.slice(0, 8)
              return (
                <li
                  key={app.id}
                  className="rounded-lg border border-border p-3 space-y-2"
                  data-testid={`scout-application-${app.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  {app.motivation && (
                    <p className="text-sm text-muted-foreground">{app.motivation}</p>
                  )}
                  {app.neighborhoods && app.neighborhoods.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Neighborhoods: {app.neighborhoods.join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busyApplicationId === app.id}
                      onClick={() => handleReview(app.id, 'approve', 'rookie')}
                    >
                      Approve ({SCOUT_TIERS.rookie.label})
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyApplicationId === app.id}
                      onClick={() => handleReview(app.id, 'approve', 'regular')}
                    >
                      Approve regular
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyApplicationId === app.id}
                      onClick={() => handleReview(app.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Signal suppression</h2>
        <p className="text-xs text-muted-foreground">
          Suppressed venues are hidden from Tonight, map intel, and organic recommendations.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading venues…</p>
        ) : (
          <ul className="space-y-3 max-h-[420px] overflow-y-auto">
            {venues.map((venue) => (
              <li
                key={venue.id}
                className="rounded-lg border border-border p-3 space-y-2"
                data-testid={`signal-suppress-row-${venue.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{venue.name}</p>
                    {venue.city && (
                      <p className="text-xs text-muted-foreground">{venue.city}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyVenueId === venue.id}
                    onClick={() => handleSuppressToggle(venue.id, true)}
                  >
                    Suppress
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`reason-${venue.id}`} className="text-xs">
                    Reason (optional)
                  </Label>
                  <Input
                    id={`reason-${venue.id}`}
                    value={suppressReason[venue.id] ?? ''}
                    placeholder="e.g. repeated spam reports"
                    onChange={(e) =>
                      setSuppressReason((prev) => ({ ...prev, [venue.id]: e.target.value }))
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default SignalAdminPage
