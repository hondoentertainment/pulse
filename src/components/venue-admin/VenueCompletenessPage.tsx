/**
 * VenueCompletenessPage — admin-only dashboard listing venues ranked by
 * data-quality completeness (worst first), backed by
 * `GET /api/admin/venues-completeness`.
 *
 * Non-admins (and the placeholder-auth demo mode, which never carries a real
 * admin role) get a clear 403 state, matching `VenueMetadataRoute`.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { cn } from '@/lib/utils'
import type { CompletenessField } from '@/lib/venue-completeness'

interface VenueCompletenessSummary {
  count: number
  averageScore: number
  pctWithHours: number
  pctWithDress: number
  pctWithAccessibility: number
  pctWithPriceRange: number
}

interface VenueCompletenessRow {
  id: string
  name: string
  city: string | null
  score: number
  missing: CompletenessField[]
}

interface VenuesCompletenessResponse {
  summary: VenueCompletenessSummary
  venues: VenueCompletenessRow[]
}

const MISSING_FIELD_LABELS: Record<CompletenessField, string> = {
  address: 'Address',
  coordinates: 'Coordinates',
  category: 'Category',
  hours: 'Hours',
  phone: 'Phone',
  website: 'Website',
  dressCode: 'Dress code',
  coverCharge: 'Cover charge',
  accessibility: 'Accessibility',
  neighborhood: 'Neighborhood',
  priceRange: 'Price range',
  mapsUrl: 'Maps link',
}

function scoreVariant(score: number): 'destructive' | 'secondary' | 'default' {
  if (score < 50) return 'destructive'
  if (score < 80) return 'secondary'
  return 'default'
}

export function VenueCompletenessPage() {
  const navigate = useNavigate()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()
  const [data, setData] = useState<VenuesCompletenessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const role =
    (session?.user?.app_metadata as Record<string, unknown> | undefined)?.role ?? null
  const isAdmin = !isPlaceholder && role === 'admin'

  useEffect(() => {
    if (authLoading || !isAdmin) {
      setLoading(false)
      return
    }

    let cancelled = false
    const token = session?.access_token

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/venues-completeness', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`)
        }
        const body = (await res.json()) as { data: VenuesCompletenessResponse }
        if (!cancelled) setData(body.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load venues')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAdmin, session?.access_token])

  if (authLoading) {
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
            You need an admin role to view venue data-quality reports. If you
            believe this is a mistake, ask an administrator to update your
            account.
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Go home
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Venue data quality</h1>
            <p className="text-sm text-muted-foreground">
              Ranked worst-first so the team can prioritize fixes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/signal')}>
              Signal admin
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </div>

        {loading && (
          <Card className="p-6 text-center text-muted-foreground border-border">
            Loading venues…
          </Card>
        )}

        {error && !loading && (
          <Card className="p-4 border-destructive/30 bg-destructive/10 text-destructive text-sm" role="alert">
            {error}
          </Card>
        )}

        {data && !loading && !error && (
          <>
            <Card className="p-4 space-y-3 border-border" data-testid="venue-completeness-summary">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                City summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-2xl font-bold">{data.summary.count}</p>
                  <p className="text-xs text-muted-foreground">Venues</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.averageScore}</p>
                  <p className="text-xs text-muted-foreground">Avg. score</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.pctWithHours}%</p>
                  <p className="text-xs text-muted-foreground">Have hours</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.pctWithDress}%</p>
                  <p className="text-xs text-muted-foreground">Have dress code</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.pctWithPriceRange}%</p>
                  <p className="text-xs text-muted-foreground">Have price range</p>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              {data.venues.length === 0 && (
                <Card className="p-6 text-center text-muted-foreground border-border">
                  No venues found.
                </Card>
              )}
              {data.venues.map((venue) => (
                <Card
                  key={venue.id}
                  className="p-4 flex items-center justify-between gap-4 border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{venue.name}</p>
                      <Badge variant={scoreVariant(venue.score)}>{venue.score}</Badge>
                    </div>
                    {venue.city && (
                      <p className="text-xs text-muted-foreground">{venue.city}</p>
                    )}
                    {venue.missing.length > 0 && (
                      <p className={cn('text-xs text-muted-foreground mt-1 truncate')}>
                        Missing: {venue.missing.map((f) => MISSING_FIELD_LABELS[f]).join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/venues/${encodeURIComponent(venue.id)}/metadata`)}
                  >
                    Edit
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default VenueCompletenessPage
