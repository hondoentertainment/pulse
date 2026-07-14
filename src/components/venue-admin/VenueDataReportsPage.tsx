/**
 * VenueDataReportsPage — admin-only queue for user-submitted catalog
 * quality signals ("hours are wrong", "menu missing", etc.), backed by
 * `GET/PATCH /api/admin/venue-data-reports`.
 *
 * Non-admins (and the placeholder-auth demo mode) get a clear 403 state,
 * matching `VenueCompletenessPage` and `VenueMetadataRoute`.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { VENUE_DATA_REPORT_LABELS, type VenueDataReportReason } from '@/lib/venue-data-reports'
import { updateVenueDataReportStatus, type VenueDataReportRow } from '@/lib/venue-admin-client'

type StatusFilter = 'pending' | 'reviewed' | 'actioned' | 'dismissed'

const STATUS_TABS: StatusFilter[] = ['pending', 'reviewed', 'actioned', 'dismissed']

const STATUS_LABELS: Record<StatusFilter, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function VenueDataReportsPage() {
  const navigate = useNavigate()
  const { session, isLoading: authLoading, isPlaceholder } = useSupabaseAuth()
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [reports, setReports] = useState<VenueDataReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)

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
        const res = await fetch(`/api/admin/venue-data-reports?status=${status}&limit=200`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`)
        }
        const body = (await res.json()) as { data: { reports: VenueDataReportRow[] } }
        if (!cancelled) setReports(body.data.reports)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAdmin, session?.access_token, status])

  const handleAction = async (report: VenueDataReportRow, next: 'reviewed' | 'actioned' | 'dismissed') => {
    setActioningId(report.id)
    try {
      await updateVenueDataReportStatus(report.id, next)
      toast.success(`Marked report ${next}`)
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update report'
      toast.error('Update failed', { description: msg })
    } finally {
      setActioningId(null)
    }
  }

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
            You need an admin role to view venue data reports. If you believe
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
            <h1 className="text-xl font-bold">Venue data reports</h1>
            <p className="text-sm text-muted-foreground">
              User-submitted catalog quality signals awaiting review.
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

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report status filter">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab}
              variant={tab === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus(tab)}
              aria-selected={tab === status}
              role="tab"
            >
              {STATUS_LABELS[tab]}
            </Button>
          ))}
        </div>

        {loading && (
          <Card className="p-6 text-center text-muted-foreground border-border">
            Loading reports…
          </Card>
        )}

        {error && !loading && (
          <Card className="p-4 border-destructive/30 bg-destructive/10 text-destructive text-sm" role="alert">
            {error}
          </Card>
        )}

        {!loading && !error && reports.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground border-border">
            No {STATUS_LABELS[status].toLowerCase()} reports.
          </Card>
        )}

        {!loading && !error && (
          <div className="space-y-2">
            {reports.map((report) => (
              <Card key={report.id} className="p-4 space-y-3 border-border" data-testid="venue-data-report-row">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {report.venues?.name ?? report.venue_id}
                      </p>
                      <Badge variant="secondary">
                        {VENUE_DATA_REPORT_LABELS[report.reason as VenueDataReportReason] ?? report.reason}
                      </Badge>
                    </div>
                    {report.venues?.city && (
                      <p className="text-xs text-muted-foreground">{report.venues.city}</p>
                    )}
                    {report.note && <p className="text-sm mt-1">{report.note}</p>}
                    {report.menu_url && (
                      <p className="text-xs mt-1">
                        Menu:{' '}
                        <a
                          href={report.menu_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-muted-foreground"
                        >
                          {report.menu_url}
                        </a>
                      </p>
                    )}
                    {report.price_range != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Suggested price range: {'$'.repeat(report.price_range)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(report.created_at)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => navigate(`/admin/venues/${encodeURIComponent(report.venue_id)}/metadata`)}
                  >
                    Edit venue
                  </Button>
                </div>

                {status === 'pending' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      disabled={actioningId === report.id}
                      onClick={() => handleAction(report, 'actioned')}
                    >
                      Mark actioned
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actioningId === report.id}
                      onClick={() => handleAction(report, 'reviewed')}
                    >
                      Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actioningId === report.id}
                      onClick={() => handleAction(report, 'dismissed')}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default VenueDataReportsPage
