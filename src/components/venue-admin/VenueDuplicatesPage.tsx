/**
 * VenueDuplicatesPage — admin-only view of likely duplicate catalog
 * entries, backed by `GET /api/admin/venue-duplicates`
 * (`src/lib/venue-dedupe.ts` groups venues by exact-name match or
 * proximity + similar-name match).
 *
 * Non-admins (and the placeholder-auth demo mode) get a clear 403 state,
 * matching `VenueCompletenessPage` and `VenueDataReportsPage`.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'

interface DuplicateVenueSummary {
  id: string
  name: string
  city: string | null
  lat: number
  lng: number
  address: string
}

interface DuplicateGroupResponse {
  id: string
  reasons: string[]
  venues: DuplicateVenueSummary[]
}

interface VenueDuplicatesResponse {
  scanned: number
  groupCount: number
  groups: DuplicateGroupResponse[]
}

const REASON_LABELS: Record<string, string> = {
  same_name: 'Same name',
  proximity_similar_name: 'Nearby + similar name',
}

export function VenueDuplicatesPage() {
  const navigate = useNavigate()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()
  const [data, setData] = useState<VenueDuplicatesResponse | null>(null)
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
        const res = await fetch('/api/admin/venue-duplicates', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`)
        }
        const body = (await res.json()) as { data: VenueDuplicatesResponse }
        if (!cancelled) setData(body.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load duplicates')
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
            You need an admin role to view duplicate venues. If you believe
            this is a mistake, ask an administrator to update your account.
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
            <h1 className="text-xl font-bold">Possible duplicate venues</h1>
            <p className="text-sm text-muted-foreground">
              Same normalized name, or within ~100m with a similar name.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/venues/completeness')}>
              Completeness
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </div>

        {loading && (
          <Card className="p-6 text-center text-muted-foreground border-border">
            Scanning venues…
          </Card>
        )}

        {error && !loading && (
          <Card className="p-4 border-destructive/30 bg-destructive/10 text-destructive text-sm" role="alert">
            {error}
          </Card>
        )}

        {data && !loading && !error && (
          <>
            <Card className="p-4 space-y-1 border-border" data-testid="venue-duplicates-summary">
              <p className="text-sm text-muted-foreground">
                Scanned <span className="font-medium text-foreground">{data.scanned}</span> venues, found{' '}
                <span className="font-medium text-foreground">{data.groupCount}</span> possible duplicate
                group{data.groupCount === 1 ? '' : 's'}.
              </p>
            </Card>

            {data.groups.length === 0 && (
              <Card className="p-6 text-center text-muted-foreground border-border">
                No likely duplicates found.
              </Card>
            )}

            <div className="space-y-3">
              {data.groups.map((group) => (
                <Card key={group.id} className="p-4 space-y-2 border-border" data-testid="venue-duplicate-group">
                  <div className="flex items-center gap-2 flex-wrap">
                    {group.reasons.map((reason) => (
                      <Badge key={reason} variant="secondary">
                        {REASON_LABELS[reason] ?? reason}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      {group.venues.length} venues
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.venues.map((venue) => (
                      <div
                        key={venue.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{venue.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {venue.address || `${venue.lat.toFixed(4)}, ${venue.lng.toFixed(4)}`}
                            {venue.city ? ` · ${venue.city}` : ''}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => navigate(`/admin/venues/${encodeURIComponent(venue.id)}/metadata`)}
                        >
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default VenueDuplicatesPage
